import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";
import { assertPinFree } from "@/lib/auth/pin";
import { userSchema } from "../schema";

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("users.manage");
  const { id } = await params;
  const d = await body(req, userSchema);
  const target = await prisma.user.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!target) fail(404, "El usuario no existe.");
  if ((d.role === "OWNER" || target.role === "OWNER") && user.role !== "OWNER") fail(403, "Solo el dueño puede cambiar a un dueño.");
  if (target.id === user.id && (!d.active || d.role !== target.role)) fail(400, "No podés desactivarte ni cambiarte el rol a vos mismo.");
  if (d.email && d.email !== target.email && (await prisma.user.findUnique({ where: { email: d.email } }))) fail(409, "Ese email ya está en uso.");
  if (d.pin) await assertPinFree(user.organizationId, d.pin, id);
  const credentialsChanged = !!d.pin || !!d.password || !d.active || d.role !== target.role;
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: {
        name: d.name, role: d.role, color: d.color, active: d.active, email: d.email || null,
        ...(d.pin ? { pinHash: await bcrypt.hash(d.pin, 10) } : {}),
        ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
        // Cambio de PIN, contraseña, rol o baja: se cortan las sesiones abiertas.
        ...(credentialsChanged ? { sessionsValidFrom: new Date() } : {}),
      },
    });
    await audit(tx, user.organizationId, user.id, "user.update", `Modificó el usuario ${d.name}${d.pin ? " (nuevo PIN)" : ""}${!d.active ? " (desactivado)" : ""}`, { entity: "user", entityId: id });
  });
});
