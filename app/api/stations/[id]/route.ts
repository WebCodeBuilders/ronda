import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";
import { stationSchema } from "../schema";

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("settings.manage");
  const { id } = await params;
  const d = await body(req, stationSchema);
  const r = await prisma.station.updateMany({ where: { id, organizationId: user.organizationId }, data: { ...d, printerHost: d.printerHost || null } });
  if (!r.count) fail(404, "La estación no existe.");
  await publish(user.organizationId, { type: "kitchen.changed" });
});

export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("settings.manage");
  const { id } = await params;
  const open = await prisma.kitchenTicket.count({ where: { stationId: id, status: { in: ["NEW", "PREPARING"] } } });
  if (open) fail(409, "La estación tiene comandas en curso.");
  await prisma.station.updateMany({ where: { id, organizationId: user.organizationId }, data: { active: false } });
  await publish(user.organizationId, { type: "kitchen.changed" });
});
