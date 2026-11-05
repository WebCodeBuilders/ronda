import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";
import { createOrder } from "@/lib/orders/service";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), status: z.enum(["PENDING", "CONFIRMED", "NO_SHOW", "CANCELLED", "DONE"]) }),
  z.object({ action: z.literal("seat"), tableId: z.string() }),
  z.object({ action: z.literal("table"), tableId: z.string().nullable() }),
]);

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("reservations.manage");
  const { id } = await params;
  const d = await body(req, schema);
  const r = await prisma.reservation.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!r) fail(404, "La reserva no existe.");
  if (d.action === "status") {
    await prisma.reservation.update({ where: { id }, data: { status: d.status } });
  } else if (d.action === "table") {
    await prisma.reservation.update({ where: { id }, data: { tableId: d.tableId } });
  } else {
    // Sentar: se abre la mesa con la cantidad de personas y el cliente de la reserva.
    if (!user.permissions.has("orders.create")) fail(403, "No tenés permiso para abrir mesas.");
    const { order } = await createOrder({ orgId: user.organizationId, user }, { type: "DINE_IN", tableId: d.tableId, guests: r.partySize, customerId: r.customerId, notes: r.notes });
    await prisma.reservation.update({ where: { id }, data: { status: "SEATED", tableId: d.tableId, seatedAt: new Date() } });
    await publish(user.organizationId, { type: "reservations.changed" });
    return { orderId: order.id };
  }
  await publish(user.organizationId, { type: "reservations.changed" });
  await publish(user.organizationId, { type: "tables.changed" });
});
