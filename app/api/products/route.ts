import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";
import { productSchema, saveProductRelations } from "@/lib/menu";

export const POST = route(async (req: Request) => {
  const user = await requireUser("menu.manage");
  const d = await body(req, productSchema);
  const id = await prisma.$transaction(async (tx) => {
    const count = await tx.product.count({ where: { organizationId: user.organizationId, categoryId: d.categoryId ?? null } });
    const { modifierGroupIds, recipe, ...data } = d;
    const p = await tx.product.create({ data: { ...data, organizationId: user.organizationId, sort: count } });
    await saveProductRelations(tx, user.organizationId, p.id, modifierGroupIds, recipe);
    return p.id;
  });
  await publish(user.organizationId, { type: "menu.changed" });
  return { id };
});
