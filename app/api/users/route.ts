import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";
import { userSchema } from "./schema";
import { assertPinFree } from "@/lib/auth/pin";

export const POST = route(async (req: Request) => {
  const user = await requireUser("users.manage");
  const d = await body(req, userSchema);
  if (!d.pin && !(d.email && d.password)) fail(400, "Poné un PIN (para las terminales) o email y contraseña.");
  if (d.role === "OWNER" && user.role !== "OWNER") fail(403, "Solo el dueño puede crear otro dueño.");
  if (d.email && (await prisma.user.findUnique({ where: { email: d.email } }))) fail(409, "Ese email ya está en uso.");
  if (d.pin) await assertPinFree(user.organizationId, d.pin);
  const u = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        organizationId: user.organizationId, name: d.name, role: d.role, color: d.color, active: d.active,
        pinHash: d.pin ? await bcrypt.hash(d.pin, 10) : null, email: d.email || null, passwordHash: d.password ? await bcrypt.hash(d.password, 10) : null,
      },
    });
    await audit(tx, user.organizationId, user.id, "user.create", `Creó el usuario ${d.name} (${d.role})`, { entity: "user", entityId: u.id });
    return u;
  });
  return { id: u.id };
});
