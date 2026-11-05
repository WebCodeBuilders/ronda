import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({ name: z.string().trim().min(1).max(40).optional(), color: z.string().optional(), stationId: z.string().nullable().optional(), sort: z.number().int().optional() });

export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("menu.manage");
  const { id } = await params;
  const r = await prisma.category.updateMany({ where: { id, organizationId: user.organizationId }, data: await body(req, schema) });
  if (!r.count) fail(404, "La categoría no existe.");
  await publish(user.organizationId, { type: "menu.changed" });
});

export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("menu.manage");
  const { id } = await params;
  const used = await prisma.product.count({ where: { categoryId: id, active: true } });
  if (used) fail(409, "La categoría tiene productos. Pasalos a otra antes de borrarla.");
  await prisma.category.updateMany({ where: { id, organizationId: user.organizationId }, data: { active: false } });
  await publish(user.organizationId, { type: "menu.changed" });
});
