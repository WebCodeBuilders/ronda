import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { fail } from "@/lib/api";

/** Dos personas con el mismo PIN en el mismo local: la terminal no sabría quién es quién al autorizar. */
export async function assertPinFree(orgId: string, pin: string, exceptId?: string) {
  const users = await prisma.user.findMany({ where: { organizationId: orgId, active: true, pinHash: { not: null }, ...(exceptId ? { id: { not: exceptId } } : {}) }, select: { pinHash: true } });
  for (const u of users) if (await bcrypt.compare(pin, u.pinHash!)) fail(409, "Ese PIN ya lo usa otra persona. Elegí otro.");
}
