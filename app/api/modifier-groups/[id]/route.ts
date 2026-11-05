import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";
import { groupSchema } from "../schema";

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("menu.manage");
  const { id } = await params;
  const d = await body(req, groupSchema);
  const g = await prisma.modifierGroup.findFirst({ where: { id, organizationId: user.organizationId }, include: { options: true } });
  if (!g) fail(404, "El grupo no existe.");
  await prisma.$transaction(async (tx) => {
    await tx.modifierGroup.update({ where: { id }, data: { name: d.name, minSelect: d.minSelect, maxSelect: d.maxSelect } });
    const keep = new Set(d.options.filter((o) => o.id).map((o) => o.id!));
    await tx.modifier.deleteMany({ where: { groupId: id, id: { notIn: [...keep] } } });
    for (const [i, o] of d.options.entries()) {
      if (o.id && g.options.some((x) => x.id === o.id)) await tx.modifier.update({ where: { id: o.id }, data: { name: o.name, priceDelta: o.priceDelta, available: o.available, sort: i } });
      else await tx.modifier.create({ data: { groupId: id, name: o.name, priceDelta: o.priceDelta, available: o.available, sort: i } });
    }
  });
  await publish(user.organizationId, { type: "menu.changed" });
});

export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("menu.manage");
  const { id } = await params;
  const r = await prisma.modifierGroup.deleteMany({ where: { id, organizationId: user.organizationId } });
  if (!r.count) fail(404, "El grupo no existe.");
  await publish(user.organizationId, { type: "menu.changed" });
});
