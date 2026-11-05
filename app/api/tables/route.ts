import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";

const SHAPES = ["SQUARE", "ROUND", "RECT", "BAR", "BOOTH", "UMBRELLA", "LOUNGER"] as const;

const schema = z.object({
  areaId: z.string(),
  name: z.string().trim().min(1).max(12),
  shape: z.enum(SHAPES).default("SQUARE"),
  seats: z.number().int().min(1).max(40).default(4),
  x: z.number().default(40),
  y: z.number().default(40),
  w: z.number().min(30).max(600).default(100),
  h: z.number().min(30).max(600).default(100),
});

export const POST = route(async (req: Request) => {
  const user = await requireUser("settings.manage");
  const data = await body(req, schema);
  const area = await prisma.area.findFirst({ where: { id: data.areaId, organizationId: user.organizationId } });
  if (!area) fail(404, "El sector no existe.");
  const dup = await prisma.diningTable.findFirst({ where: { organizationId: user.organizationId, name: data.name, active: true } });
  if (dup) fail(409, `Ya hay una mesa ${data.name}.`);
  const t = await prisma.diningTable.create({ data: { ...data, organizationId: user.organizationId } });
  await publish(user.organizationId, { type: "tables.changed" });
  return { id: t.id };
});
