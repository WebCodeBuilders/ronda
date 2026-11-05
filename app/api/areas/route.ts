import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({ name: z.string().trim().min(1).max(40) });

export const POST = route(async (req: Request) => {
  const user = await requireUser("settings.manage");
  const { name } = await body(req, schema);
  const count = await prisma.area.count({ where: { organizationId: user.organizationId } });
  const a = await prisma.area.create({ data: { organizationId: user.organizationId, name, sort: count } });
  await publish(user.organizationId, { type: "tables.changed" });
  return { id: a.id };
});
