import "server-only";
import bcrypt from "bcryptjs";
import type { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { permissionsFor, type Permission } from "@/lib/permissions";

export type Tx = Prisma.TransactionClient;

/** Próximo correlativo del comercio (pedido, comanda). Atómico. */
export async function nextNumber(tx: Tx, organizationId: string, key: string): Promise<number> {
  const c = await tx.counter.upsert({
    where: { organizationId_key: { organizationId, key } },
    create: { organizationId, key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return c.value;
}

export async function audit(
  tx: Tx,
  organizationId: string,
  userId: string | null,
  action: string,
  summary: string,
  extra: { entity?: string; entityId?: string; amount?: number } = {},
) {
  await tx.auditLog.create({ data: { organizationId, userId, action, summary, ...extra } });
}

/**
 * Autorización de encargado: alguien con el permiso pone su PIN en la terminal
 * del mozo. Devuelve quién autorizó, para el historial.
 */
export async function authorizeByPin(organizationId: string, pin: string, perm: Permission): Promise<{ id: string; name: string } | null> {
  if (!/^\d{4}$/.test(pin)) return null;
  const users = await prisma.user.findMany({ where: { organizationId, active: true, pinHash: { not: null } }, select: { id: true, name: true, role: true, pinHash: true } });
  for (const u of users) {
    if (!permissionsFor(u.role).has(perm)) continue;
    if (u.pinHash && (await bcrypt.compare(pin, u.pinHash))) return { id: u.id, name: u.name };
  }
  return null;
}

/** Consume (o devuelve) los insumos de la receta de lo que se vendió. */
export async function moveRecipeStock(
  tx: Tx,
  organizationId: string,
  lines: { productId: string | null; quantity: number }[],
  kind: "SALE" | "RETURN",
  orderId: string,
  userId: string | null,
) {
  const qtyByProduct = new Map<string, number>();
  for (const l of lines) if (l.productId) qtyByProduct.set(l.productId, (qtyByProduct.get(l.productId) ?? 0) + l.quantity);
  if (qtyByProduct.size === 0) return;
  const recipe = await tx.recipeItem.findMany({ where: { productId: { in: [...qtyByProduct.keys()] } } });
  const byIngredient = new Map<string, number>();
  for (const r of recipe) {
    const q = r.quantity * (qtyByProduct.get(r.productId) ?? 0);
    byIngredient.set(r.ingredientId, (byIngredient.get(r.ingredientId) ?? 0) + q);
  }
  const sign = kind === "SALE" ? -1 : 1;
  for (const [ingredientId, q] of byIngredient) {
    await tx.ingredient.update({ where: { id: ingredientId }, data: { stock: { increment: sign * q } } });
    await tx.stockMovement.create({ data: { organizationId, ingredientId, kind, quantity: sign * q, orderId, userId } });
  }
}
