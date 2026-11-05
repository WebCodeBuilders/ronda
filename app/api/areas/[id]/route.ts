import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({ name: z.string().trim().min(1).max(40).optional(), sort: z.number().int().optional(), height: z.number().int().min(300).max(3000).optional(), width: z.number().int().min(300).max(3000).optional() });

export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("settings.manage");
  const { id } = await params;
  const a = await prisma.area.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!a) fail(404, "El sector no existe.");
  await prisma.area.update({ where: { id }, data: await body(req, schema) });
  await publish(user.organizationId, { type: "tables.changed" });
});

export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("settings.manage");
  const { id } = await params;
  const a = await prisma.area.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!a) fail(404, "El sector no existe.");
  const tables = await prisma.diningTable.count({ where: { areaId: id, active: true } });
  if (tables) fail(409, "El sector tiene mesas. Sacalas o pasalas a otro sector primero.");
  await prisma.area.update({ where: { id }, data: { active: false } });
  await publish(user.organizationId, { type: "tables.changed" });
});
