import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, route } from "@/lib/api";
import { throttle } from "@/lib/auth/throttle";
import { publish } from "@/lib/realtime/bus";
import { addItems, createOrder, sendOrder } from "@/lib/orders/service";

/**
 * Lo que la mesa pide desde el QR, sin login: llamar al mozo, la cuenta, o un
 * pedido. Con aprobación activada, el pedido queda "sin marchar" en la mesa y
 * el mozo lo revisa y lo marcha con un toque.
 */
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("call") }),
  z.object({ action: z.literal("bill"), preference: z.string().max(40).optional() }),
  z.object({
    action: z.literal("order"),
    guests: z.number().int().min(1).max(30).optional(),
    items: z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(20), modifierIds: z.array(z.string()).max(20).optional(), notes: z.string().max(120).optional().nullable() })).min(1).max(30),
  }),
]);

export const POST = route(async (req: Request, { params }: { params: Promise<{ token: string }> }) => {
  const { token } = await params;
  throttle(`qr:${token}`, 12);
  const table = await prisma.diningTable.findUnique({ where: { qrToken: token }, include: { organization: true } });
  if (!table || !table.active) fail(404, "Este QR ya no es válido. Pedile ayuda al mozo.");
  const org = table.organization;
  const d = await body(req, schema);
  const open = await prisma.order.findFirst({ where: { tableId: table.id, status: { in: ["OPEN", "BILLING"] } } });

  if (d.action === "call" || d.action === "bill") {
    const dup = await prisma.serviceRequest.findFirst({ where: { tableId: table.id, kind: d.action === "call" ? "CALL_WAITER" : "BILL", status: { in: ["OPEN", "ACK"] } } });
    if (!dup) {
      const r = await prisma.serviceRequest.create({
        data: { organizationId: org.id, tableId: table.id, kind: d.action === "call" ? "CALL_WAITER" : "BILL", detail: d.action === "bill" ? d.preference ?? null : null, orderId: open?.id ?? null },
      });
      await publish(org.id, { type: "request.new", requestId: r.id, tableName: table.name, kind: r.kind });
      await publish(org.id, { type: "tables.changed" });
    }
    return { ok: true };
  }

  if (!org.qrOrderingEnabled) fail(403, "En este local se pide al mozo. Tocá \"Llamar al mozo\".");
  const ctx = { orgId: org.id, user: null };
  const order = open ?? (await createOrder(ctx, { type: "QR", tableId: table.id, guests: d.guests ?? 1, source: "QR" })).order;
  await addItems(ctx, order.id, d.items.map((i) => ({ ...i, notes: i.notes ?? null })));
  if (org.qrOrderNeedsApproval) {
    const r = await prisma.serviceRequest.create({ data: { organizationId: org.id, tableId: table.id, kind: "ORDER", orderId: order.id, detail: `${d.items.reduce((s, i) => s + i.quantity, 0)} productos` } });
    await publish(org.id, { type: "request.new", requestId: r.id, tableName: table.name, kind: "ORDER" });
  } else {
    await sendOrder(ctx, order.id);
  }
  await publish(org.id, { type: "tables.changed" });
  return { ok: true, approval: org.qrOrderNeedsApproval };
});
