import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";
import { newPairingCode } from "@/lib/auth/pairing";

const schema = z.object({ name: z.string().trim().min(1).max(40), kind: z.enum(["POS", "WAITER", "KDS", "DISPLAY"]), stationId: z.string().nullable().optional() });

export const POST = route(async (req: Request) => {
  const user = await requireUser("settings.manage");
  const d = await body(req, schema);
  const code = await newPairingCode();
  const dev = await prisma.device.create({ data: { ...d, organizationId: user.organizationId, pairingCode: code, pairingExpires: new Date(Date.now() + 30 * 60_000) } });
  return { id: dev.id, code };
});
