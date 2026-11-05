import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({ methodId: z.string(), amount: z.number().positive(), reference: z.string().max(80).nullable().optional() });

/** El cliente paga (todo o parte) de su cuenta corriente. Entra a la caja abierta. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("orders.charge");
  const { id } = await params;
  const d = await body(req, schema);
  await prisma.$transaction(async (tx) => {
    const c = await tx.customer.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!c) fail(404, "El cliente no existe.");
    if (d.amount > c.balance + 0.01) fail(400, "El pago es mayor que la deuda.");
    const m = await tx.paymentMethod.findFirst({ where: { id: d.methodId, organizationId: user.organizationId, active: true } });
    if (!m || m.kind === "ACCOUNT") fail(400, "Elegí cómo paga (no puede ser cuenta corriente).");
    const s = await tx.cashSession.findFirst({ where: { organizationId: user.organizationId, closedAt: null } });
    if (!s) fail(409, "La caja está cerrada.", "CASH_CLOSED");
    await tx.payment.create({ data: { customerId: c.id, methodId: m.id, cashSessionId: s.id, amount: d.amount, reference: d.reference ?? "Pago de cuenta corriente", createdById: user.id } });
    await tx.customer.update({ where: { id: c.id }, data: { balance: { decrement: d.amount } } });
    await audit(tx, user.organizationId, user.id, "customer.payment", `${c.name} pagó ${d.amount.toFixed(2)} de su cuenta corriente (${m.name})`, { entity: "customer", entityId: c.id, amount: d.amount });
  });
  await publish(user.organizationId, { type: "cash.changed" });
});
