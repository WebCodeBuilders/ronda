import "server-only";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/api";
import { audit, authorizeByPin, moveRecipeStock, nextNumber, type Tx } from "@/lib/db-helpers";
import { computeTotals, lineTotal, methodAdjustment, remaining, serviceChargeFor } from "./totals";
import { orderLabel } from "./labels";
import { formatBill, formatComanda } from "@/lib/printing/format";
import { dispatchPrintJobs } from "@/lib/printing/queue";
import { publish } from "@/lib/realtime/bus";
import { round2 } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth/session";

/**
 * Motor de pedidos. TODA modificación de un pedido pasa por acá: la usan la
 * caja, la app del mozo, el mostrador, el delivery y la carta QR. Las pantallas
 * solo dicen QUÉ quieren hacer; los precios, los totales, las comandas, el
 * stock y el historial los resuelve el servidor.
 */

export type Ctx = { orgId: string; user: CurrentUser | null };

const ACTIVE = ["OPEN", "BILLING"];

type ModSnap = { groupName: string; name: string; priceDelta: number };

async function loadOrder(tx: Tx, orgId: string, orderId: string) {
  const order = await tx.order.findFirst({ where: { id: orderId, organizationId: orgId }, include: { table: true } });
  if (!order) fail(404, "El pedido no existe.");
  return order;
}

function assertActive(order: { status: string }) {
  if (!ACTIVE.includes(order.status)) fail(409, order.status === "PAID" ? "El pedido ya está cobrado." : "El pedido está anulado.");
}

export async function recalcOrder(tx: Tx, orderId: string) {
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { select: { unitPrice: true, quantity: true, status: true } }, organization: { select: { serviceChargePerGuest: true } } },
  });
  const t = computeTotals({
    items: order.items,
    discountPct: order.discountPct,
    discountAmount: order.discountAmount,
    serviceCharge: serviceChargeFor(order.type, order.guests, order.organization.serviceChargePerGuest),
    deliveryFee: order.type === "DELIVERY" ? order.deliveryFee : 0,
  });
  return tx.order.update({ where: { id: orderId }, data: { subtotal: t.subtotal, serviceCharge: t.serviceCharge, total: t.total } });
}

// ─── Abrir ────────────────────────────────────────────────────────────

export type CreateOrderInput = {
  type: string;
  tableId?: string | null;
  guests?: number;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryFee?: number;
  notes?: string | null;
  source?: string;
  scheduledFor?: Date | null;
};

export async function createOrder(ctx: Ctx, input: CreateOrderInput) {
  const result = await prisma.$transaction(async (tx) => {
    let tableId: string | null = null;
    if (input.type === "DINE_IN" || input.type === "QR") {
      if (!input.tableId) fail(400, "Elegí una mesa.");
      const table = await tx.diningTable.findFirst({ where: { id: input.tableId, organizationId: ctx.orgId, active: true } });
      if (!table) fail(404, "La mesa no existe.");
      // Dos mozos abriendo la misma mesa al mismo tiempo: el segundo entra al pedido del primero.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${table.id}))`;
      const existing = await tx.order.findFirst({ where: { tableId: table.id, status: { in: ACTIVE } } });
      if (existing) return { order: existing, created: false };
      tableId = table.id;
    }
    let customerName = input.customerName ?? null;
    let customerPhone = input.customerPhone ?? null;
    let deliveryAddress = input.deliveryAddress ?? null;
    if (input.customerId) {
      const c = await tx.customer.findFirst({ where: { id: input.customerId, organizationId: ctx.orgId } });
      if (!c) fail(404, "El cliente no existe.");
      customerName ??= c.name;
      customerPhone ??= c.phone;
      deliveryAddress ??= c.address ? [c.address, c.addressNotes].filter(Boolean).join(" · ") : null;
    }
    if (input.type === "DELIVERY" && !deliveryAddress) fail(400, "Falta la dirección de entrega.");
    const number = await nextNumber(tx, ctx.orgId, "order");
    const order = await tx.order.create({
      data: {
        organizationId: ctx.orgId,
        number,
        type: input.type,
        tableId,
        guests: Math.max(1, input.guests ?? 1),
        waiterId: ctx.user?.id ?? null,
        customerId: input.customerId ?? null,
        customerName,
        customerPhone,
        deliveryAddress,
        deliveryFee: input.type === "DELIVERY" ? Math.max(0, input.deliveryFee ?? 0) : 0,
        notes: input.notes ?? null,
        source: input.source ?? "STAFF",
        scheduledFor: input.scheduledFor ?? null,
        fulfillment: input.type === "DINE_IN" || input.type === "QR" ? null : "PENDING",
      },
    });
    await recalcOrder(tx, order.id);
    return { order, created: true };
  });
  if (result.created) {
    await publish(ctx.orgId, { type: "order.changed", orderId: result.order.id, tableId: result.order.tableId });
    if (result.order.tableId) await publish(ctx.orgId, { type: "tables.changed" });
  }
  return result;
}

// ─── Cargar ───────────────────────────────────────────────────────────

export type AddItemInput = {
  productId: string;
  quantity: number;
  modifierIds?: string[];
  notes?: string | null;
  course?: number;
  seat?: number | null;
  price?: number; // solo productos de precio libre
};

export async function addItems(ctx: Ctx, orderId: string, items: AddItemInput[], opts: { createdById?: string | null } = {}) {
  if (items.length === 0) fail(400, "No hay nada para agregar.");
  const order = await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    assertActive(order);
    const products = await tx.product.findMany({
      where: { id: { in: items.map((i) => i.productId) }, organizationId: ctx.orgId, active: true },
      include: {
        category: { select: { stationId: true } },
        modifierGroups: { include: { group: { include: { options: true } } } },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));
    for (const it of items) {
      const p = byId.get(it.productId);
      if (!p) fail(404, "Uno de los productos ya no existe.");
      if (!p.available) fail(409, `${p.name} no está disponible (sin stock).`);
      if (!(it.quantity > 0)) fail(400, "La cantidad tiene que ser mayor a cero.");
      // Modificadores: se validan contra los grupos del producto, con su mínimo y máximo.
      const chosen = new Set(it.modifierIds ?? []);
      const mods: ModSnap[] = [];
      for (const pg of p.modifierGroups) {
        const picked = pg.group.options.filter((o) => chosen.has(o.id));
        if (picked.length < pg.group.minSelect) fail(400, `${p.name}: elegí ${pg.group.name.toLowerCase()}.`);
        if (pg.group.maxSelect > 0 && picked.length > pg.group.maxSelect) fail(400, `${p.name}: ${pg.group.name} admite hasta ${pg.group.maxSelect}.`);
        for (const o of picked) mods.push({ groupName: pg.group.name, name: o.name, priceDelta: o.priceDelta });
      }
      let base = p.price;
      if (p.openPrice) {
        if (it.price === undefined || !(it.price >= 0)) fail(400, `${p.name}: cargá el precio.`);
        base = it.price;
      }
      const unitPrice = round2(base + mods.reduce((s, m) => s + m.priceDelta, 0));
      const notes = it.notes?.trim() || null;
      const course = it.course ?? p.course;
      const seat = it.seat ?? null;
      // Lo mismo, sin marchar todavía: se suma al renglón que ya está ("2× Pinta", no dos renglones).
      const same = await tx.orderItem.findFirst({
        where: { orderId: order.id, productId: p.id, status: "DRAFT", unitPrice, notes, course, seat },
      });
      const sameMods = same && JSON.stringify((same.modifiers as ModSnap[]).map((m) => m.name).sort()) === JSON.stringify(mods.map((m) => m.name).sort());
      if (same && sameMods) {
        const quantity = same.quantity + it.quantity;
        await tx.orderItem.update({ where: { id: same.id }, data: { quantity, total: lineTotal(unitPrice, quantity) } });
        continue;
      }
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          productId: p.id,
          stationId: p.stationId ?? p.category?.stationId ?? null,
          name: p.shortName || p.name,
          unitPrice,
          quantity: it.quantity,
          total: lineTotal(unitPrice, it.quantity),
          modifiers: mods,
          notes,
          course,
          seat,
          status: "DRAFT",
          createdById: opts.createdById ?? ctx.user?.id ?? null,
        },
      });
    }
    // Si había pedido la cuenta y se agrega algo, vuelve a estar abierto.
    if (order.status === "BILLING") await tx.order.update({ where: { id: order.id }, data: { status: "OPEN" } });
    return recalcOrder(tx, order.id);
  });
  await publish(ctx.orgId, { type: "order.changed", orderId, tableId: order.tableId });
  return order;
}

export async function updateDraftItem(ctx: Ctx, itemId: string, patch: { quantity?: number; notes?: string | null; course?: number; seat?: number | null }) {
  const item = await prisma.orderItem.findFirst({ where: { id: itemId, order: { organizationId: ctx.orgId } }, include: { order: true } });
  if (!item) fail(404, "El renglón no existe.");
  assertActive(item.order);
  if (item.status !== "DRAFT" && (patch.quantity !== undefined || patch.course !== undefined)) {
    fail(409, "Ya está marchado: para cambiar la cantidad, anulalo y cargalo de nuevo.");
  }
  await prisma.$transaction(async (tx) => {
    const quantity = patch.quantity ?? item.quantity;
    if (!(quantity > 0)) fail(400, "La cantidad tiene que ser mayor a cero.");
    await tx.orderItem.update({
      where: { id: item.id },
      data: {
        quantity,
        total: lineTotal(item.unitPrice, quantity),
        notes: patch.notes === undefined ? undefined : patch.notes?.trim() || null,
        course: patch.course,
        seat: patch.seat === undefined ? undefined : patch.seat,
      },
    });
    await recalcOrder(tx, item.orderId);
  });
  await publish(ctx.orgId, { type: "order.changed", orderId: item.orderId, tableId: item.order.tableId });
}

// ─── Marchar ──────────────────────────────────────────────────────────

type FireItem = { id: string; productId: string | null; stationId: string | null; name: string; quantity: number; modifiers: unknown; notes: string | null; course: number; seat: number | null };

/**
 * Manda a producción una tanda de renglones: una comanda por estación, con su
 * impresión (si la estación tiene comandera) y el consumo de insumos.
 */
async function fire(tx: Tx, orgId: string, orderId: string, items: FireItem[], userId: string | null, heading?: string) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId }, include: { table: true, waiter: { select: { name: true } } } });
  const productIds = items.map((i) => i.productId).filter((x): x is string => !!x);
  const products = await tx.product.findMany({ where: { id: { in: productIds } }, select: { id: true, skipKitchen: true } });
  const skip = new Set(products.filter((p) => p.skipKitchen).map((p) => p.id));
  const now = new Date();
  const printJobIds: string[] = [];
  const stationIds = new Set<string>();

  const direct = items.filter((i) => !i.stationId || (i.productId && skip.has(i.productId)));
  if (direct.length) {
    await tx.orderItem.updateMany({ where: { id: { in: direct.map((i) => i.id) } }, data: { status: "SERVED", sentAt: now, readyAt: now, servedAt: now } });
  }
  const toKitchen = items.filter((i) => !direct.includes(i));
  const byStation = new Map<string, FireItem[]>();
  for (const i of toKitchen) byStation.set(i.stationId!, [...(byStation.get(i.stationId!) ?? []), i]);

  const held = await tx.orderItem.findMany({ where: { orderId, status: "HOLD" }, select: { stationId: true, quantity: true, name: true, course: true } });

  for (const [stationId, list] of byStation) {
    const station = await tx.station.findUniqueOrThrow({ where: { id: stationId } });
    stationIds.add(stationId);
    const number = await nextNumber(tx, orgId, "ticket");
    const ticket = await tx.kitchenTicket.create({ data: { organizationId: orgId, orderId, stationId, number } });
    await tx.orderItem.updateMany({ where: { id: { in: list.map((i) => i.id) } }, data: { status: "SENT", sentAt: now, ticketId: ticket.id } });
    if (station.printerEnabled && station.printerHost) {
      const content = formatComanda({
        width: station.printerWidth,
        stationName: station.name,
        label: orderLabel(order),
        ticketNumber: number,
        waiterName: order.waiter?.name,
        guests: order.type === "DINE_IN" ? order.guests : undefined,
        items: list.map((i) => ({ quantity: i.quantity, name: i.name, modifiers: (i.modifiers as ModSnap[]) ?? [], notes: i.notes, course: i.course, seat: i.seat })),
        createdAt: now,
        heading,
        notes: order.notes,
        followUp: held.filter((h) => h.stationId === stationId).map((h) => `${h.quantity} x ${h.name}`),
      });
      const job = await tx.printJob.create({
        data: { organizationId: orgId, stationId, kind: "COMANDA", title: `Comanda ${number} · ${orderLabel(order)}`, content, host: station.printerHost, port: station.printerPort },
      });
      printJobIds.push(job.id);
    }
  }
  await moveRecipeStock(tx, orgId, items.map((i) => ({ productId: i.productId, quantity: i.quantity })), "SALE", orderId, userId);
  // Para llevar / delivery: arranca el circuito apenas hay algo en cocina.
  if (order.fulfillment === "PENDING" && toKitchen.length) {
    await tx.order.update({ where: { id: orderId }, data: { fulfillment: "PREPARING" } });
  }
  return { printJobIds, stationIds: [...stationIds] };
}

const FIRE_SELECT = { id: true, productId: true, stationId: true, name: true, quantity: true, modifiers: true, notes: true, course: true, seat: true } as const;

/**
 * "Marchar": manda lo cargado. Con `holdLater`, sale ya el primer paso (y las
 * bebidas) y lo demás queda en espera hasta que el mozo diga "marchá los principales".
 */
export async function sendOrder(ctx: Ctx, orderId: string, opts: { holdLater?: boolean } = {}) {
  const out = await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    assertActive(order);
    const drafts = await tx.orderItem.findMany({ where: { orderId, status: "DRAFT" }, select: FIRE_SELECT });
    if (drafts.length === 0) fail(409, "No hay nada nuevo para marchar.");
    let now = drafts;
    if (opts.holdLater) {
      const food = drafts.filter((d) => d.course > 0).map((d) => d.course);
      const first = food.length ? Math.min(...food) : 0;
      now = drafts.filter((d) => d.course === 0 || d.course === first);
      const later = drafts.filter((d) => !now.includes(d));
      if (later.length) await tx.orderItem.updateMany({ where: { id: { in: later.map((d) => d.id) } }, data: { status: "HOLD" } });
    }
    return fire(tx, ctx.orgId, orderId, now, ctx.user?.id ?? null);
  });
  dispatchPrintJobs(out.printJobIds);
  await publish(ctx.orgId, { type: "kitchen.changed", stationIds: out.stationIds });
  await publish(ctx.orgId, { type: "order.changed", orderId });
  await publish(ctx.orgId, { type: "tables.changed" });
  return out;
}

/** "¡Marchá los principales!" — libera lo que estaba en espera de un paso. */
export async function fireCourse(ctx: Ctx, orderId: string, course?: number) {
  const out = await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    assertActive(order);
    const held = await tx.orderItem.findMany({ where: { orderId, status: "HOLD" }, select: FIRE_SELECT });
    if (held.length === 0) fail(409, "No hay nada en espera.");
    const target = course ?? Math.min(...held.map((h) => h.course));
    const list = held.filter((h) => h.course === target);
    return fire(tx, ctx.orgId, orderId, list, ctx.user?.id ?? null, "MARCHAR");
  });
  dispatchPrintJobs(out.printJobIds);
  await publish(ctx.orgId, { type: "kitchen.changed", stationIds: out.stationIds });
  await publish(ctx.orgId, { type: "order.changed", orderId });
  return out;
}

// ─── Anular ───────────────────────────────────────────────────────────

/**
 * Anular un renglón. Lo que no se marchó se borra sin más. Lo que ya está en
 * cocina queda anulado (no se borra: se ve tachado en la pantalla, se imprime
 * la anulación y queda en el historial con quién y por qué).
 */
export async function voidItem(ctx: Ctx, itemId: string, input: { reason?: string; managerPin?: string }) {
  const item = await prisma.orderItem.findFirst({
    where: { id: itemId, order: { organizationId: ctx.orgId } },
    include: { order: { include: { table: true } }, station: true, ticket: true },
  });
  if (!item) fail(404, "El renglón no existe.");
  assertActive(item.order);
  if (item.status === "VOID") return;
  if (item.status === "DRAFT" || item.status === "HOLD") {
    await prisma.$transaction(async (tx) => {
      await tx.orderItem.delete({ where: { id: item.id } });
      await recalcOrder(tx, item.orderId);
    });
    await publish(ctx.orgId, { type: "order.changed", orderId: item.orderId, tableId: item.order.tableId });
    return;
  }
  if (!input.reason?.trim()) fail(400, "Decí el motivo de la anulación.");
  let authorizer: { id: string; name: string } | null = null;
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: ctx.orgId }, select: { voidNeedsManager: true } });
  const can = ctx.user?.permissions.has("orders.void") || !org.voidNeedsManager;
  if (!can) {
    if (!input.managerPin) fail(403, "Hace falta la autorización de un encargado.", "NEEDS_MANAGER");
    authorizer = await authorizeByPin(ctx.orgId, input.managerPin, "orders.void");
    if (!authorizer) fail(403, "PIN de encargado incorrecto.", "NEEDS_MANAGER");
  }
  const jobs: string[] = [];
  await prisma.$transaction(async (tx) => {
    await tx.orderItem.update({
      where: { id: item.id },
      data: { status: "VOID", voidedAt: new Date(), voidReason: input.reason!.trim(), voidedById: authorizer?.id ?? ctx.user?.id ?? null },
    });
    // Los insumos vuelven solo si el plato no se llegó a preparar.
    if (["SENT"].includes(item.status)) {
      await moveRecipeStock(tx, ctx.orgId, [{ productId: item.productId, quantity: item.quantity }], "RETURN", item.orderId, ctx.user?.id ?? null);
    }
    if (item.ticketId) await settleTicket(tx, item.ticketId);
    if (item.station?.printerEnabled && item.station.printerHost && item.ticket && item.ticket.status !== "DONE") {
      const content = formatComanda({
        width: item.station.printerWidth,
        stationName: item.station.name,
        label: orderLabel(item.order),
        ticketNumber: item.ticket.number,
        items: [{ quantity: item.quantity, name: item.name, modifiers: (item.modifiers as ModSnap[]) ?? [], notes: input.reason, course: item.course }],
        createdAt: new Date(),
        heading: "ANULADO",
      });
      const job = await tx.printJob.create({
        data: { organizationId: ctx.orgId, stationId: item.stationId, kind: "ANULACION", title: `Anulación · ${orderLabel(item.order)}`, content, host: item.station.printerHost, port: item.station.printerPort },
      });
      jobs.push(job.id);
    }
    const who = authorizer ? ` (autorizó ${authorizer.name})` : "";
    await audit(tx, ctx.orgId, ctx.user?.id ?? null, "item.void", `Anuló ${item.quantity} x ${item.name} en ${orderLabel(item.order)}: ${input.reason}${who}`, {
      entity: "order", entityId: item.orderId, amount: item.total,
    });
    await recalcOrder(tx, item.orderId);
  });
  dispatchPrintJobs(jobs);
  await publish(ctx.orgId, { type: "kitchen.changed", stationIds: item.stationId ? [item.stationId] : [] });
  await publish(ctx.orgId, { type: "order.changed", orderId: item.orderId, tableId: item.order.tableId });
}

/** Recalcula el estado de una comanda según sus renglones vivos. */
export async function settleTicket(tx: Tx, ticketId: string) {
  const items = await tx.orderItem.findMany({ where: { ticketId }, select: { status: true } });
  const live = items.filter((i) => i.status !== "VOID");
  if (live.length === 0) {
    await tx.kitchenTicket.update({ where: { id: ticketId }, data: { status: "VOID" } });
    return "VOID";
  }
  if (live.every((i) => i.status === "SERVED")) {
    await tx.kitchenTicket.update({ where: { id: ticketId }, data: { status: "DONE", doneAt: new Date() } });
    return "DONE";
  }
  if (live.every((i) => i.status === "READY" || i.status === "SERVED")) {
    const t = await tx.kitchenTicket.findUniqueOrThrow({ where: { id: ticketId } });
    if (t.status !== "READY") await tx.kitchenTicket.update({ where: { id: ticketId }, data: { status: "READY", readyAt: new Date() } });
    return "READY";
  }
  return null;
}

// ─── Datos del pedido ─────────────────────────────────────────────────

export async function updateOrder(
  ctx: Ctx,
  orderId: string,
  patch: { guests?: number; customerId?: string | null; notes?: string | null; waiterId?: string | null; customerName?: string | null; customerPhone?: string | null; deliveryAddress?: string | null; deliveryFee?: number },
) {
  const order = await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    assertActive(order);
    if (patch.waiterId) {
      const w = await tx.user.findFirst({ where: { id: patch.waiterId, organizationId: ctx.orgId, active: true } });
      if (!w) fail(404, "El mozo no existe.");
    }
    if (patch.customerId) {
      const c = await tx.customer.findFirst({ where: { id: patch.customerId, organizationId: ctx.orgId } });
      if (!c) fail(404, "El cliente no existe.");
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        guests: patch.guests !== undefined ? Math.max(1, Math.floor(patch.guests)) : undefined,
        customerId: patch.customerId,
        notes: patch.notes,
        waiterId: patch.waiterId,
        customerName: patch.customerName,
        customerPhone: patch.customerPhone,
        deliveryAddress: patch.deliveryAddress,
        deliveryFee: patch.deliveryFee !== undefined ? Math.max(0, patch.deliveryFee) : undefined,
      },
    });
    if (patch.waiterId && patch.waiterId !== order.waiterId) {
      await audit(tx, ctx.orgId, ctx.user?.id ?? null, "order.waiter", `Cambió el mozo de ${orderLabel(order)}`, { entity: "order", entityId: orderId });
    }
    return recalcOrder(tx, orderId);
  });
  await publish(ctx.orgId, { type: "order.changed", orderId, tableId: order.tableId });
  await publish(ctx.orgId, { type: "tables.changed" });
  return order;
}

export async function setDiscount(ctx: Ctx, orderId: string, input: { pct: number; amount: number; reason?: string | null; managerPin?: string }) {
  let authorizer: { id: string; name: string } | null = null;
  if (!ctx.user?.permissions.has("orders.discount")) {
    if (!input.managerPin) fail(403, "Hace falta la autorización de un encargado.", "NEEDS_MANAGER");
    authorizer = await authorizeByPin(ctx.orgId, input.managerPin, "orders.discount");
    if (!authorizer) fail(403, "PIN de encargado incorrecto.", "NEEDS_MANAGER");
  }
  const order = await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    assertActive(order);
    await tx.order.update({
      where: { id: orderId },
      data: { discountPct: Math.min(100, Math.max(0, input.pct)), discountAmount: Math.max(0, input.amount), discountReason: input.reason?.trim() || null },
    });
    const updated = await recalcOrder(tx, orderId);
    const desc = [input.pct > 0 ? `${input.pct} %` : null, input.amount > 0 ? `$ ${input.amount}` : null].filter(Boolean).join(" + ") || "sin descuento";
    await audit(tx, ctx.orgId, ctx.user?.id ?? null, "order.discount", `Descuento ${desc} en ${orderLabel(order)}${input.reason ? `: ${input.reason}` : ""}${authorizer ? ` (autorizó ${authorizer.name})` : ""}`, {
      entity: "order", entityId: orderId, amount: round2(updated.subtotal - (updated.total - updated.serviceCharge - (updated.type === "DELIVERY" ? updated.deliveryFee : 0))),
    });
    return updated;
  });
  await publish(ctx.orgId, { type: "order.changed", orderId, tableId: order.tableId });
  return order;
}

// ─── Mesas: pasar y unir ──────────────────────────────────────────────

export async function transferTable(ctx: Ctx, orderId: string, toTableId: string) {
  await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    assertActive(order);
    const table = await tx.diningTable.findFirst({ where: { id: toTableId, organizationId: ctx.orgId, active: true } });
    if (!table) fail(404, "La mesa no existe.");
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${table.id}))`;
    const busy = await tx.order.findFirst({ where: { tableId: table.id, status: { in: ACTIVE } } });
    if (busy) fail(409, `La mesa ${table.name} está ocupada. Si querés juntarlas, usá "Unir mesas".`);
    await tx.order.update({ where: { id: orderId }, data: { tableId: table.id, type: order.type === "QR" ? "QR" : "DINE_IN" } });
    await audit(tx, ctx.orgId, ctx.user?.id ?? null, "order.transfer", `Pasó ${orderLabel(order)} a la mesa ${table.name}`, { entity: "order", entityId: orderId });
  });
  await publish(ctx.orgId, { type: "order.changed", orderId });
  await publish(ctx.orgId, { type: "tables.changed" });
  await publish(ctx.orgId, { type: "kitchen.changed" });
}

/** Une dos mesas: todo lo de `sourceOrderId` pasa a `targetOrderId`. */
export async function mergeOrders(ctx: Ctx, targetOrderId: string, sourceOrderId: string) {
  if (targetOrderId === sourceOrderId) fail(400, "Elegí otra mesa.");
  await prisma.$transaction(async (tx) => {
    const target = await loadOrder(tx, ctx.orgId, targetOrderId);
    const source = await loadOrder(tx, ctx.orgId, sourceOrderId);
    assertActive(target);
    assertActive(source);
    if (source.paidAmount > 0) fail(409, "La otra mesa ya tiene cobros: cerrala por separado.");
    await tx.orderItem.updateMany({ where: { orderId: source.id }, data: { orderId: target.id } });
    await tx.kitchenTicket.updateMany({ where: { orderId: source.id }, data: { orderId: target.id } });
    await tx.order.update({ where: { id: target.id }, data: { guests: target.guests + source.guests } });
    await tx.order.update({ where: { id: source.id }, data: { status: "CANCELLED", closedAt: new Date(), cancelReason: `Unida a ${orderLabel(target)}`, subtotal: 0, total: 0 } });
    if (source.tableId) await tx.diningTable.update({ where: { id: source.tableId }, data: { mergedIntoId: null } });
    await audit(tx, ctx.orgId, ctx.user?.id ?? null, "order.merge", `Unió ${orderLabel(source)} con ${orderLabel(target)}`, { entity: "order", entityId: target.id });
    await recalcOrder(tx, target.id);
  });
  await publish(ctx.orgId, { type: "order.changed", orderId: targetOrderId });
  await publish(ctx.orgId, { type: "tables.changed" });
  await publish(ctx.orgId, { type: "kitchen.changed" });
}

// ─── Cuenta y cobro ───────────────────────────────────────────────────

/** Precuenta: la mesa pasa a "pidió la cuenta" y se imprime en la caja. */
export async function printBill(ctx: Ctx, orderId: string, opts: { markBilling?: boolean } = { markBilling: true }) {
  const res = await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    const full = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { items: { where: { status: { not: "VOID" } }, orderBy: { createdAt: "asc" } }, waiter: { select: { name: true } }, organization: true, payments: { include: { method: true } } },
    });
    const org = full.organization;
    const isReceipt = order.status === "PAID";
    if (!isReceipt && opts.markBilling !== false) {
      await tx.order.update({ where: { id: orderId }, data: { status: "BILLING", billPrintedAt: new Date() } });
    }
    const content = formatBill({
      width: org.receiptPrinterWidth,
      businessName: org.name,
      address: org.address,
      taxId: org.taxId,
      title: isReceipt ? "RECIBO" : "PRECUENTA",
      label: orderLabel(order),
      orderNumber: order.number,
      waiterName: full.waiter?.name,
      guests: order.type === "DINE_IN" ? order.guests : undefined,
      lines: groupBillLines(full.items),
      subtotal: full.subtotal,
      discount: round2(full.subtotal * (full.discountPct / 100) + full.discountAmount),
      serviceCharge: full.serviceCharge,
      deliveryFee: full.type === "DELIVERY" ? full.deliveryFee : 0,
      total: full.total,
      payments: isReceipt ? full.payments.map((p) => ({ name: p.method.name, amount: p.amount + p.surcharge })) : undefined,
      tip: full.tip,
      change: full.payments.reduce((s, p) => s + p.change, 0),
      suggestedTipPct: org.suggestedTipPct,
      footer: org.ticketFooter,
      date: new Date(),
    });
    const job = await tx.printJob.create({
      data: {
        organizationId: ctx.orgId,
        kind: isReceipt ? "RECIBO" : "PRECUENTA",
        title: `${isReceipt ? "Recibo" : "Precuenta"} · ${orderLabel(order)}`,
        content,
        host: org.receiptPrinterHost,
        port: org.receiptPrinterPort,
      },
    });
    return { jobId: job.id, browser: !org.receiptPrinterHost, tableId: order.tableId };
  });
  if (!res.browser) dispatchPrintJobs([res.jobId]);
  await publish(ctx.orgId, { type: "order.changed", orderId, tableId: res.tableId });
  await publish(ctx.orgId, { type: "tables.changed" });
  return { jobId: res.jobId, browserPrint: res.browser };
}

/** En el ticket, "2 x Coca" y no dos renglones de "1 x Coca". */
export function groupBillLines(items: { name: string; quantity: number; unitPrice: number; modifiers: unknown }[]) {
  const map = new Map<string, { quantity: number; name: string; total: number; modifiers: ModSnap[] }>();
  for (const i of items) {
    const mods = (i.modifiers as ModSnap[]) ?? [];
    const key = `${i.name}|${i.unitPrice}|${mods.map((m) => m.name).join(",")}`;
    const cur = map.get(key);
    if (cur) {
      cur.quantity += i.quantity;
      cur.total = round2(cur.total + i.unitPrice * i.quantity);
    } else map.set(key, { quantity: i.quantity, name: i.name, total: round2(i.unitPrice * i.quantity), modifiers: mods });
  }
  return [...map.values()];
}

export type PaymentInput = {
  methodId: string;
  amount: number;
  tip?: number;
  tendered?: number;
  customerId?: string | null;
  reference?: string | null;
  items?: { itemId: string; quantity: number }[];
};

export async function addPayment(ctx: Ctx, orderId: string, input: PaymentInput) {
  if (!ctx.user?.permissions.has("orders.charge")) fail(403, "No tenés permiso para cobrar.");
  const out = await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    assertActive(order);
    const method = await tx.paymentMethod.findFirst({ where: { id: input.methodId, organizationId: ctx.orgId, active: true } });
    if (!method) fail(404, "El medio de pago no existe.");
    const session = await tx.cashSession.findFirst({ where: { organizationId: ctx.orgId, closedAt: null }, orderBy: { openedAt: "desc" } });
    if (!session) fail(409, "La caja está cerrada. Abrila para poder cobrar.", "CASH_CLOSED");
    const amount = round2(input.amount);
    const due = remaining(order.total, order.paidAmount);
    if (!(amount > 0)) fail(400, "El importe tiene que ser mayor a cero.");
    if (amount > due + 0.01) fail(400, `Falta cobrar ${due.toFixed(2).replace(".", ",")}: el importe no puede ser mayor.`);
    const tip = round2(Math.max(0, input.tip ?? 0));
    const surcharge = methodAdjustment(amount, method.adjustPct);
    let change = 0;
    if (method.kind === "CASH" && input.tendered !== undefined) {
      if (input.tendered + 0.001 < amount + tip + surcharge) fail(400, "Lo que entrega el cliente no alcanza.");
      change = round2(input.tendered - amount - tip - surcharge);
    }
    let customerId = input.customerId ?? order.customerId;
    if (method.kind === "ACCOUNT") {
      if (!customerId) fail(400, "Para cuenta corriente elegí el cliente.");
      const c = await tx.customer.findFirst({ where: { id: customerId, organizationId: ctx.orgId } });
      if (!c) fail(404, "El cliente no existe.");
      if (c.creditLimit > 0 && c.balance + amount > c.creditLimit + 0.01) fail(409, `${c.name} supera su límite de cuenta corriente.`);
      await tx.customer.update({ where: { id: c.id }, data: { balance: { increment: amount } } });
      if (!order.customerId) await tx.order.update({ where: { id: orderId }, data: { customerId: c.id } });
    } else customerId = order.customerId;
    // División por ítems: se anota qué renglones quedaron pagos.
    for (const it of input.items ?? []) {
      const row = await tx.orderItem.findFirst({ where: { id: it.itemId, orderId } });
      if (!row) continue;
      await tx.orderItem.update({ where: { id: row.id }, data: { paidQty: Math.min(row.quantity, row.paidQty + it.quantity) } });
    }
    await tx.payment.create({
      data: { orderId, customerId, methodId: method.id, cashSessionId: session.id, amount, tip, surcharge, change, reference: input.reference ?? null, createdById: ctx.user!.id },
    });
    const paid = round2(order.paidAmount + amount);
    await tx.order.update({ where: { id: orderId }, data: { paidAmount: paid, tip: round2(order.tip + tip) } });
    const closed = paid + 0.009 >= order.total;
    let fired: { printJobIds: string[]; stationIds: string[] } | null = null;
    if (closed) fired = await closePaidOrder(tx, ctx, orderId);
    return { closed, change, tableId: order.tableId, fired };
  });
  if (out.fired) {
    dispatchPrintJobs(out.fired.printJobIds);
    if (out.fired.stationIds.length) await publish(ctx.orgId, { type: "kitchen.changed", stationIds: out.fired.stationIds });
  }
  await publish(ctx.orgId, { type: "order.changed", orderId, tableId: out.tableId });
  await publish(ctx.orgId, { type: "cash.changed" });
  if (out.closed) await publish(ctx.orgId, { type: "tables.changed" });
  return { closed: out.closed, change: out.change };
}

/**
 * Cierra un pedido pagado. En mostrador lo habitual es cobrar primero: lo que
 * quedó sin marchar sale a cocina en este momento.
 */
async function closePaidOrder(tx: Tx, ctx: Ctx, orderId: string) {
  const drafts = await tx.orderItem.findMany({ where: { orderId, status: { in: ["DRAFT", "HOLD"] } }, select: FIRE_SELECT });
  const fired = drafts.length ? await fire(tx, ctx.orgId, orderId, drafts, ctx.user?.id ?? null) : { printJobIds: [], stationIds: [] };
  const order = await tx.order.update({ where: { id: orderId }, data: { status: "PAID", closedAt: new Date() }, include: { organization: { select: { pesosPerPoint: true } } } });
  if (order.customerId && order.organization.pesosPerPoint > 0) {
    const pts = Math.floor(order.total / order.organization.pesosPerPoint);
    if (pts > 0) await tx.customer.update({ where: { id: order.customerId }, data: { points: { increment: pts } } });
  }
  // Mesa en el salón: lo que quedaba por entregar se da por entregado.
  if (order.type === "DINE_IN" || order.type === "QR") {
    await tx.orderItem.updateMany({ where: { orderId, status: { in: ["READY"] } }, data: { status: "SERVED", servedAt: new Date() } });
    await tx.serviceRequest.updateMany({ where: { tableId: order.tableId ?? "-", status: { not: "DONE" } }, data: { status: "DONE", resolvedAt: new Date() } });
  }
  return fired;
}

export async function cancelOrder(ctx: Ctx, orderId: string, input: { reason: string; managerPin?: string }) {
  if (!input.reason?.trim()) fail(400, "Decí el motivo.");
  let authorizer: { id: string; name: string } | null = null;
  if (!ctx.user?.permissions.has("orders.cancel")) {
    if (!input.managerPin) fail(403, "Hace falta la autorización de un encargado.", "NEEDS_MANAGER");
    authorizer = await authorizeByPin(ctx.orgId, input.managerPin, "orders.cancel");
    if (!authorizer) fail(403, "PIN de encargado incorrecto.", "NEEDS_MANAGER");
  }
  const res = await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    assertActive(order);
    if (order.paidAmount > 0) fail(409, "El pedido tiene cobros. Anulalos desde la caja antes de anular el pedido.");
    const items = await tx.orderItem.findMany({ where: { orderId, status: { not: "VOID" } } });
    const sentNotStarted = items.filter((i) => i.status === "SENT");
    await moveRecipeStock(tx, ctx.orgId, sentNotStarted.map((i) => ({ productId: i.productId, quantity: i.quantity })), "RETURN", orderId, ctx.user?.id ?? null);
    await tx.orderItem.updateMany({ where: { orderId, status: { in: ["DRAFT", "HOLD"] } }, data: { status: "VOID", voidedAt: new Date(), voidReason: input.reason } });
    await tx.orderItem.updateMany({ where: { orderId, status: { notIn: ["VOID", "SERVED"] } }, data: { status: "VOID", voidedAt: new Date(), voidReason: input.reason } });
    await tx.kitchenTicket.updateMany({ where: { orderId, status: { in: ["NEW", "PREPARING", "READY"] } }, data: { status: "VOID" } });
    await tx.order.update({ where: { id: orderId }, data: { status: "CANCELLED", closedAt: new Date(), cancelReason: input.reason } });
    await audit(tx, ctx.orgId, ctx.user?.id ?? null, "order.cancel", `Anuló ${orderLabel(order)} (${order.total.toFixed(2)}): ${input.reason}${authorizer ? ` (autorizó ${authorizer.name})` : ""}`, {
      entity: "order", entityId: orderId, amount: order.total,
    });
    return { tableId: order.tableId };
  });
  await publish(ctx.orgId, { type: "order.changed", orderId, tableId: res.tableId });
  await publish(ctx.orgId, { type: "tables.changed" });
  await publish(ctx.orgId, { type: "kitchen.changed" });
}

export async function reopenOrder(ctx: Ctx, orderId: string, reason: string) {
  if (!ctx.user?.permissions.has("orders.reopen")) fail(403, "No tenés permiso para reabrir.");
  await prisma.$transaction(async (tx) => {
    const order = await loadOrder(tx, ctx.orgId, orderId);
    if (order.status !== "PAID") fail(409, "Solo se reabre un pedido cobrado.");
    if (order.tableId) {
      const busy = await tx.order.findFirst({ where: { tableId: order.tableId, status: { in: ACTIVE }, id: { not: orderId } } });
      if (busy) fail(409, "La mesa ya tiene otro pedido abierto.");
    }
    await tx.order.update({ where: { id: orderId }, data: { status: "OPEN", closedAt: null } });
    await audit(tx, ctx.orgId, ctx.user?.id ?? null, "order.reopen", `Reabrió ${orderLabel(order)}: ${reason}`, { entity: "order", entityId: orderId, amount: order.total });
  });
  await publish(ctx.orgId, { type: "order.changed", orderId });
  await publish(ctx.orgId, { type: "tables.changed" });
}

/** Anula un cobro (devolución). Queda negativo en la caja abierta. */
export async function refundPayment(ctx: Ctx, paymentId: string, reason: string) {
  if (!ctx.user?.permissions.has("orders.reopen")) fail(403, "Solo un encargado puede anular cobros.");
  const res = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.findFirst({ where: { id: paymentId, order: { organizationId: ctx.orgId } }, include: { order: { include: { table: true } }, method: true } });
    if (!p || !p.order) fail(404, "El cobro no existe.");
    if (p.amount <= 0) fail(409, "Eso ya es una devolución.");
    const session = await tx.cashSession.findFirst({ where: { organizationId: ctx.orgId, closedAt: null } });
    if (!session) fail(409, "Abrí la caja para registrar la devolución.", "CASH_CLOSED");
    await tx.payment.create({
      data: { orderId: p.orderId, customerId: p.customerId, methodId: p.methodId, cashSessionId: session.id, amount: -p.amount, tip: -p.tip, surcharge: -p.surcharge, reference: `Devolución: ${reason}`, createdById: ctx.user!.id },
    });
    if (p.method.kind === "ACCOUNT" && p.customerId) await tx.customer.update({ where: { id: p.customerId }, data: { balance: { decrement: p.amount } } });
    await tx.order.update({
      where: { id: p.orderId! },
      data: { paidAmount: round2(p.order.paidAmount - p.amount), tip: round2(p.order.tip - p.tip), status: p.order.status === "PAID" ? "OPEN" : p.order.status, closedAt: null },
    });
    await audit(tx, ctx.orgId, ctx.user!.id, "payment.refund", `Devolvió ${p.method.name} ${p.amount.toFixed(2)} de ${orderLabel(p.order)}: ${reason}`, { entity: "order", entityId: p.orderId!, amount: p.amount });
    return { orderId: p.orderId!, tableId: p.order.tableId };
  });
  await publish(ctx.orgId, { type: "order.changed", orderId: res.orderId, tableId: res.tableId });
  await publish(ctx.orgId, { type: "cash.changed" });
  await publish(ctx.orgId, { type: "tables.changed" });
}

// ─── Para llevar y delivery ───────────────────────────────────────────

export async function setFulfillment(ctx: Ctx, orderId: string, step: string, courierId?: string | null) {
  const order = await prisma.order.findFirst({ where: { id: orderId, organizationId: ctx.orgId } });
  if (!order) fail(404, "El pedido no existe.");
  if (!order.fulfillment) fail(409, "Este pedido no tiene circuito de entrega.");
  if (step === "ON_THE_WAY" && order.type !== "DELIVERY") fail(400, "Solo un delivery sale \"en camino\".");
  await prisma.$transaction(async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { fulfillment: step, courierId: courierId === undefined ? undefined : courierId } });
    if (step === "DELIVERED") {
      await tx.orderItem.updateMany({ where: { orderId, status: { in: ["READY", "SENT", "PREPARING"] } }, data: { status: "SERVED", servedAt: new Date() } });
      const tickets = await tx.kitchenTicket.findMany({ where: { orderId, status: { in: ["NEW", "PREPARING", "READY"] } } });
      for (const t of tickets) await tx.kitchenTicket.update({ where: { id: t.id }, data: { status: "DONE", doneAt: new Date() } });
    }
  });
  await publish(ctx.orgId, { type: "order.changed", orderId });
  await publish(ctx.orgId, { type: "kitchen.changed" });
}
