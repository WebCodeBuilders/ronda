import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, route } from "@/lib/api";
import { getDevice, startSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/home";
import { throttle } from "@/lib/auth/throttle";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Email inválido"), password: z.string().min(1, "Falta la contraseña") });

export const POST = route(async (req: Request) => {
  const { email, password } = await body(req, schema);
  throttle(`login:${email}`);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    fail(401, "Email o contraseña incorrectos.");
  }
  const device = await getDevice();
  await startSession(user.id, user.organizationId, device?.organizationId === user.organizationId ? device.id : undefined);
  return { ok: true, home: homeFor({ role: user.role }) };
});
