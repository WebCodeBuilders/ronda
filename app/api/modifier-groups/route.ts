import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";
import { groupSchema } from "./schema";

export const POST = route(async (req: Request) => {
  const user = await requireUser("menu.manage");
  const d = await body(req, groupSchema);
  const g = await prisma.modifierGroup.create({
    data: { organizationId: user.organizationId, name: d.name, minSelect: d.minSelect, maxSelect: d.maxSelect, options: { create: d.options.map((o, i) => ({ name: o.name, priceDelta: o.priceDelta, available: o.available, sort: i })) } },
  });
  await publish(user.organizationId, { type: "menu.changed" });
  return { id: g.id };
});
