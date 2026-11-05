import "server-only";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";
import { settleTicket } from "./service";
import { orderLabel } from "./labels";
import { formatComanda } from "@/lib/printing/format";
import { dispatchPrintJobs } from "@/lib/printing/queue";

/**
 * Lo que pasa en la cocina: tomar una comanda, marcar platos listos, despachar.
 * Cuando una comanda queda lista se avisa en vivo al mozo de la mesa (y, en
 * para llevar, a la pantalla de retiro).
 */

export type TicketAction = "start" | "ready" | "done" | "recall" | "priority" | "reprint";

async function loadTicket(orgId: string, ticketId: string) {
  const t = await prisma.kitchenTicket.findFirst({
    where: { id: ticketId, organizationId: orgId },
    include: { order: { include: { table: true, waiter: { select: { name: true } } } }, station: true, items: true },
  });
  if (!t) fail(404, "La comanda no existe.");
  return t;
}

async function notifyReady(orgId: string, ticketId: string) {
  const t = await prisma.kitchenTicket.findUniqueOrThrow({ where: { id: ticketId }, include: { order: { include: { table: true } }, station: true } });
  await publish(orgId, { type: "ticket.ready", orderId: t.orderId, ticketId: t.id, label: orderLabel(t.order), waiterId: t.order.waiterId, stationName: t.station.name });
  // Para llevar / mostrador / delivery: si todas sus comandas están listas, el pedido está listo.
  if (t.order.fulfillment && ["PENDING", "PREPARING"].includes(t.order.fulfillment)) {
    const open = await prisma.kitchenTicket.count({ where: { orderId: t.orderId, status: { in: ["NEW", "PREPARING"] } } });
    if (open === 0) await prisma.order.update({ where: { id: t.orderId }, data: { fulfillment: "READY" } });
  }
}

export async function ticketAction(orgId: string, ticketId: string, action: TicketAction) {
  const t = await loadTicket(orgId, ticketId);
  const now = new Date();
  let becameReady = false;
  if (action === "reprint") {
    if (!t.station.printerEnabled || !t.station.printerHost) fail(409, "Esta estación no tiene impresora configurada.");
    const live = t.items.filter((i) => i.status !== "VOID");
    const job = await prisma.printJob.create({
      data: {
        organizationId: orgId, stationId: t.stationId, kind: "COMANDA", title: `Reimpresión comanda ${t.number}`,
        content: formatComanda({
          width: t.station.printerWidth, stationName: t.station.name, label: orderLabel(t.order), ticketNumber: t.number, waiterName: t.order.waiter?.name,
          items: live.map((i) => ({ quantity: i.quantity, name: i.name, modifiers: (i.modifiers as { name: string }[]) ?? [], notes: i.notes, course: i.course, seat: i.seat })),
          createdAt: t.createdAt, heading: "REIMPRESIÓN",
        }),
        host: t.station.printerHost, port: t.station.printerPort,
      },
    });
    dispatchPrintJobs([job.id]);
    return;
  }
  await prisma.$transaction(async (tx) => {
    switch (action) {
      case "start":
        if (t.status !== "NEW") return;
        await tx.kitchenTicket.update({ where: { id: t.id }, data: { status: "PREPARING", startedAt: now } });
        await tx.orderItem.updateMany({ where: { ticketId: t.id, status: "SENT" }, data: { status: "PREPARING", startedAt: now } });
        break;
      case "ready":
        await tx.orderItem.updateMany({ where: { ticketId: t.id, status: { in: ["SENT", "PREPARING"] } }, data: { status: "READY", readyAt: now } });
        await tx.kitchenTicket.update({ where: { id: t.id }, data: { status: "READY", readyAt: now, startedAt: t.startedAt ?? now } });
        becameReady = t.status !== "READY";
        break;
      case "done":
        await tx.orderItem.updateMany({ where: { ticketId: t.id, status: { in: ["SENT", "PREPARING", "READY"] } }, data: { status: "SERVED", servedAt: now, readyAt: now } });
        await tx.kitchenTicket.update({ where: { id: t.id }, data: { status: "DONE", doneAt: now, readyAt: t.readyAt ?? now } });
        break;
      case "recall":
        await tx.orderItem.updateMany({ where: { ticketId: t.id, status: { in: ["READY", "SERVED"] } }, data: { status: "PREPARING", readyAt: null, servedAt: null } });
        await tx.kitchenTicket.update({ where: { id: t.id }, data: { status: "PREPARING", readyAt: null, doneAt: null } });
        break;
      case "priority":
        await tx.kitchenTicket.update({ where: { id: t.id }, data: { priority: !t.priority } });
        break;
    }
  });
  if (becameReady) await notifyReady(orgId, t.id);
  await publish(orgId, { type: "kitchen.changed", stationIds: [t.stationId] });
  await publish(orgId, { type: "order.changed", orderId: t.orderId, tableId: t.order.tableId });
  if (action === "ready" || action === "done") await publish(orgId, { type: "tables.changed" });
}

/** Marca un plato suelto (toque sobre el renglón en la pantalla de cocina). */
export async function toggleItemReady(orgId: string, itemId: string) {
  const item = await prisma.orderItem.findFirst({ where: { id: itemId, order: { organizationId: orgId } }, include: { order: true } });
  if (!item || !item.ticketId) fail(404, "El plato no existe.");
  const now = new Date();
  let state: string | null = null;
  await prisma.$transaction(async (tx) => {
    if (item.status === "READY") {
      await tx.orderItem.update({ where: { id: item.id }, data: { status: "PREPARING", readyAt: null } });
      await tx.kitchenTicket.update({ where: { id: item.ticketId! }, data: { status: "PREPARING", readyAt: null } });
    } else if (["SENT", "PREPARING"].includes(item.status)) {
      await tx.orderItem.update({ where: { id: item.id }, data: { status: "READY", readyAt: now, startedAt: item.startedAt ?? now } });
      const t = await tx.kitchenTicket.findUniqueOrThrow({ where: { id: item.ticketId! } });
      if (t.status === "NEW") await tx.kitchenTicket.update({ where: { id: t.id }, data: { status: "PREPARING", startedAt: now } });
      state = await settleTicket(tx, item.ticketId!);
    }
  });
  if (state === "READY") await notifyReady(orgId, item.ticketId);
  await publish(orgId, { type: "kitchen.changed", stationIds: item.stationId ? [item.stationId] : [] });
  await publish(orgId, { type: "order.changed", orderId: item.orderId, tableId: item.order.tableId });
}

/** El mozo retira lo listo de una mesa (todo lo READY del pedido pasa a entregado). */
export async function serveReady(orgId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, organizationId: orgId } });
  if (!order) fail(404, "El pedido no existe.");
  const now = new Date();
  const tickets = await prisma.$transaction(async (tx) => {
    await tx.orderItem.updateMany({ where: { orderId, status: "READY" }, data: { status: "SERVED", servedAt: now } });
    const ts = await tx.kitchenTicket.findMany({ where: { orderId, status: "READY" } });
    for (const t of ts) await settleTicket(tx, t.id);
    return ts;
  });
  await publish(orgId, { type: "kitchen.changed", stationIds: [...new Set(tickets.map((t) => t.stationId))] });
  await publish(orgId, { type: "order.changed", orderId, tableId: order.tableId });
  await publish(orgId, { type: "tables.changed" });
}
