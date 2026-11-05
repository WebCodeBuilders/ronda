import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, route } from "@/lib/api";
import { hashToken, newToken, setDeviceCookie } from "@/lib/auth/session";
import { throttle } from "@/lib/auth/throttle";
import { homeFor } from "@/lib/auth/home";

const schema = z.object({ code: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 números") });

/** Vincula este navegador como un equipo del local (tablet, caja, pantalla de cocina). */
export const POST = route(async (req: Request) => {
  const { code } = await body(req, schema);
  throttle(`pair:${req.headers.get("x-forwarded-for") ?? "local"}`, 10);
  const device = await prisma.device.findUnique({ where: { pairingCode: code } });
  if (!device || !device.active || !device.pairingExpires || device.pairingExpires < new Date()) {
    fail(404, "El código no existe o ya venció. Generá uno nuevo en Configuración › Equipos.");
  }
  const token = newToken();
  await prisma.device.update({
    where: { id: device.id },
    data: { tokenHash: hashToken(token), pairingCode: null, pairingExpires: null, lastSeenAt: new Date() },
  });
  await setDeviceCookie(token);
  const needsPin = device.kind !== "KDS" && device.kind !== "DISPLAY";
  return { ok: true, next: needsPin ? "/pin" : homeFor({ deviceKind: device.kind }) };
});
