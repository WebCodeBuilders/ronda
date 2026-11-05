import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { newPairingCode } from "@/lib/auth/pairing";

const schema = z.object({
  action: z.enum(["update", "newCode", "unlink"]),
  name: z.string().trim().min(1).max(40).optional(),
  kind: z.enum(["POS", "WAITER", "KDS", "DISPLAY"]).optional(),
  stationId: z.string().nullable().optional(),
});

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("settings.manage");
  const { id } = await params;
  const d = await body(req, schema);
  const dev = await prisma.device.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!dev) fail(404, "El equipo no existe.");
  if (d.action === "update") {
    await prisma.device.update({ where: { id }, data: { name: d.name, kind: d.kind, stationId: d.stationId } });
    return { ok: true };
  }
  if (d.action === "newCode") {
    const code = await newPairingCode();
    // Un código nuevo desvincula el navegador anterior: sirve para reemplazar una tablet perdida.
    await prisma.device.update({ where: { id }, data: { pairingCode: code, pairingExpires: new Date(Date.now() + 30 * 60_000), tokenHash: null, active: true } });
    return { code };
  }
  await prisma.device.update({ where: { id }, data: { tokenHash: null, pairingCode: null, active: false } });
  return { ok: true };
});
