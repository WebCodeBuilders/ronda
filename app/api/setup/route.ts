import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, route } from "@/lib/api";
import { startSession } from "@/lib/auth/session";
import { createBusiness } from "@/lib/setup";
import { throttle } from "@/lib/auth/throttle";

const schema = z.object({
  businessName: z.string().trim().min(2, "Poné el nombre del comercio").max(80),
  kind: z.string().max(30).default("restaurant"),
  ownerName: z.string().trim().min(2, "Poné tu nombre").max(60),
  email: z.string().trim().toLowerCase().email("Email inválido"),
  password: z.string().min(8, "La contraseña tiene que tener 8 caracteres o más").max(200),
  pin: z.string().regex(/^\d{4}$/, "El PIN tiene 4 números"),
  tables: z.number().int().min(0).max(60).default(12),
});

/**
 * Primer arranque: solo funciona mientras no haya ningún comercio cargado.
 * Después de eso devuelve 403 para siempre (no se puede usar para colarse).
 */
export const POST = route(async (req: Request) => {
  throttle("setup", 5);
  // Antes que nada: si ya hay un comercio, no se mira ni se valida nada más.
  if ((await prisma.organization.count()) > 0) fail(403, "El sistema ya está configurado. Entrá con tu email.");
  const d = await body(req, schema);
  const { owner, org } = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('ronda-setup'))`;
    if ((await tx.organization.count()) > 0) fail(403, "El sistema ya está configurado. Entrá con tu email.");
    return createBusiness(tx, d);
  });
  await startSession(owner.id, org.id);
  return { ok: true, home: "/" };
});
