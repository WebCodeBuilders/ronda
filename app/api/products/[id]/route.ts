import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";
import { publish } from "@/lib/realtime/bus";
import { productSchema, saveProductRelations } from "@/lib/menu";

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("menu.manage");
  const { id } = await params;
  const d = await body(req, productSchema);
  const p = await prisma.product.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!p) fail(404, "El producto no existe.");
  await prisma.$transaction(async (tx) => {
    const { modifierGroupIds, recipe, ...data } = d;
    await tx.product.update({ where: { id }, data });
    await saveProductRelations(tx, user.organizationId, id, modifierGroupIds, recipe);
    if (p.price !== d.price) await audit(tx, user.organizationId, user.id, "product.price", `Cambió el precio de ${d.name}: ${p.price} → ${d.price}`, { entity: "product", entityId: id, amount: d.price });
  });
  await publish(user.organizationId, { type: "menu.changed" });
});

/** Se da de baja (las ventas viejas siguen apuntando a él). */
export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("menu.manage");
  const { id } = await params;
  const r = await prisma.product.updateMany({ where: { id, organizationId: user.organizationId }, data: { active: false } });
  if (!r.count) fail(404, "El producto no existe.");
  await publish(user.organizationId, { type: "menu.changed" });
});
