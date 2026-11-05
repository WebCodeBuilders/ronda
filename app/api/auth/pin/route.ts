import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, route } from "@/lib/api";
import { getDevice, startSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/home";
import { throttle } from "@/lib/auth/throttle";

const schema = z.object({ userId: z.string().min(1), pin: z.string().regex(/^\d{4}$/, "El PIN tiene 4 números") });

/** Entrada con PIN: solo desde un equipo vinculado al comercio. */
export const POST = route(async (req: Request) => {
  const { userId, pin } = await body(req, schema);
  const device = await getDevice();
  if (!device) fail(401, "Este equipo no está vinculado. Vinculalo desde Configuración › Equipos.", "NO_DEVICE");
  throttle(`pin:${device.id}:${userId}`, 6);
  const user = await prisma.user.findFirst({ where: { id: userId, organizationId: device.organizationId, active: true } });
  if (!user || !user.pinHash || !(await bcrypt.compare(pin, user.pinHash))) fail(401, "PIN incorrecto.");
  await startSession(user.id, user.organizationId, device.id);
  return { ok: true, home: homeFor({ deviceKind: device.kind === "POS" ? null : device.kind, role: user.role }) };
});
