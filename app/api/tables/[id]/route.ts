import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";

const SHAPES = ["SQUARE", "ROUND", "RECT", "BAR", "BOOTH", "UMBRELLA", "LOUNGER"] as const;

const schema = z.object({
  name: z.string().trim().min(1).max(12).optional(),
  shape: z.enum(SHAPES).optional(),
  seats: z.number().int().min(1).max(40).optional(),
  areaId: z.string().optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  w: z.number().min(30).max(600).optional(),
  h: z.number().min(30).max(600).optional(),
  rotation: z.number().optional(),
});

export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("settings.manage");
  const { id } = await params;
  const data = await body(req, schema);
  const t = await prisma.diningTable.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!t) fail(404, "La mesa no existe.");
  if (data.name && data.name !== t.name) {
    const dup = await prisma.diningTable.findFirst({ where: { organizationId: user.organizationId, name: data.name, active: true, id: { not: id } } });
    if (dup) fail(409, `Ya hay una mesa ${data.name}.`);
  }
  await prisma.diningTable.update({ where: { id }, data });
  await publish(user.organizationId, { type: "tables.changed" });
});

export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("settings.manage");
  const { id } = await params;
  const t = await prisma.diningTable.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!t) fail(404, "La mesa no existe.");
  const open = await prisma.order.count({ where: { tableId: id, status: { in: ["OPEN", "BILLING"] } } });
  if (open) fail(409, "La mesa tiene un pedido abierto.");
  // Se da de baja (no se borra): el historial de ventas sigue apuntando a ella.
  await prisma.diningTable.update({ where: { id }, data: { active: false, name: `${t.name}·baja·${Date.now().toString(36)}` } });
  await publish(user.organizationId, { type: "tables.changed" });
});
