import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({ kind: z.enum(["IN", "OUT"]), amount: z.number().positive(), reason: z.string().trim().min(1).max(120) });

export const POST = route(async (req: Request) => {
  const user = await requireUser("cash.manage");
  const d = await body(req, schema);
  await prisma.$transaction(async (tx) => {
    const s = await tx.cashSession.findFirst({ where: { organizationId: user.organizationId, closedAt: null } });
    if (!s) fail(409, "La caja está cerrada.");
    await tx.cashMovement.create({ data: { cashSessionId: s.id, kind: d.kind, amount: d.amount, reason: d.reason, userId: user.id } });
    await audit(tx, user.organizationId, user.id, d.kind === "IN" ? "cash.in" : "cash.out", `${d.kind === "IN" ? "Ingreso" : "Retiro"} de caja ${d.amount.toFixed(2)}: ${d.reason}`, { amount: d.amount });
  });
  await publish(user.organizationId, { type: "cash.changed" });
});
