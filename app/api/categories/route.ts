import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({ name: z.string().trim().min(1).max(40), color: z.string().default("accent"), stationId: z.string().nullable().optional() });

export const POST = route(async (req: Request) => {
  const user = await requireUser("menu.manage");
  const d = await body(req, schema);
  const count = await prisma.category.count({ where: { organizationId: user.organizationId } });
  const c = await prisma.category.create({ data: { ...d, organizationId: user.organizationId, sort: count } });
  await publish(user.organizationId, { type: "menu.changed" });
  return { id: c.id };
});
