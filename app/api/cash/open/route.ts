import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({ openingAmount: z.number().min(0) });

export const POST = route(async (req: Request) => {
  const user = await requireUser("cash.manage");
  const { openingAmount } = await body(req, schema);
  await prisma.$transaction(async (tx) => {
    const open = await tx.cashSession.findFirst({ where: { organizationId: user.organizationId, closedAt: null } });
    if (open) fail(409, "Ya hay una caja abierta.");
    await tx.cashSession.create({ data: { organizationId: user.organizationId, openedById: user.id, openingAmount } });
    await audit(tx, user.organizationId, user.id, "cash.open", `Abrió la caja con ${openingAmount.toFixed(2)}`, { amount: openingAmount });
  });
  await publish(user.organizationId, { type: "cash.changed" });
});
