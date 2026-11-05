import "server-only";
import { z } from "zod";
import { fail } from "@/lib/api";
import type { Tx } from "@/lib/db-helpers";

export const productSchema = z.object({
  name: z.string().trim().min(1).max(80),
  shortName: z.string().trim().max(30).nullable().optional(),
  description: z.string().trim().max(300).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  stationId: z.string().nullable().optional(),
  price: z.number().min(0),
  cost: z.number().min(0).default(0),
  course: z.number().int().min(0).max(9).default(2),
  prepMinutes: z.number().int().min(0).max(240).default(10),
  available: z.boolean().default(true),
  showInQrMenu: z.boolean().default(true),
  skipKitchen: z.boolean().default(false),
  openPrice: z.boolean().default(false),
  imageUrl: z.string().max(400).nullable().optional(),
  tags: z.array(z.string().trim().max(24)).max(8).default([]),
  modifierGroupIds: z.array(z.string()).max(20).default([]),
  recipe: z.array(z.object({ ingredientId: z.string(), quantity: z.number().positive() })).max(40).default([]),
});

export type ProductInput = z.infer<typeof productSchema>;

/** Modificadores y receta del producto: se reemplazan enteros, validando que sean del comercio. */
export async function saveProductRelations(tx: Tx, orgId: string, productId: string, groupIds: string[], recipe: { ingredientId: string; quantity: number }[]) {
  if (groupIds.length) {
    const ok = await tx.modifierGroup.count({ where: { id: { in: groupIds }, organizationId: orgId } });
    if (ok !== new Set(groupIds).size) fail(400, "Algún grupo de opciones no existe.");
  }
  if (recipe.length) {
    const ids = recipe.map((r) => r.ingredientId);
    const ok = await tx.ingredient.count({ where: { id: { in: ids }, organizationId: orgId } });
    if (ok !== new Set(ids).size) fail(400, "Algún insumo de la receta no existe.");
  }
  await tx.productModifierGroup.deleteMany({ where: { productId } });
  await tx.recipeItem.deleteMany({ where: { productId } });
  for (const [i, g] of [...new Set(groupIds)].entries()) await tx.productModifierGroup.create({ data: { productId, groupId: g, sort: i } });
  const merged = new Map<string, number>();
  for (const r of recipe) merged.set(r.ingredientId, (merged.get(r.ingredientId) ?? 0) + r.quantity);
  for (const [ingredientId, quantity] of merged) await tx.recipeItem.create({ data: { productId, ingredientId, quantity } });
}

/** Redondeo comercial de un precio: a la centena (o al múltiplo pedido). */
export function roundPrice(n: number, step: number): number {
  if (step <= 0) return Math.round(n * 100) / 100;
  return Math.round(n / step) * step;
}
