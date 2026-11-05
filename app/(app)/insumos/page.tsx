import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { StockView } from "@/components/stock/StockView";
import { startOfToday } from "@/lib/reports";

export const metadata = { title: "Insumos · ronda" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await pageUser("stock.manage");
  const weekAgo = new Date(startOfToday().getTime() - 7 * 86_400_000);
  const [ingredients, movements, usage] = await Promise.all([
    prisma.ingredient.findMany({ where: { organizationId: user.organizationId, active: true }, orderBy: { name: "asc" }, include: { _count: { select: { recipeItems: true } } } }),
    prisma.stockMovement.findMany({ where: { organizationId: user.organizationId, kind: { not: "SALE" } }, orderBy: { createdAt: "desc" }, take: 30, include: { ingredient: { select: { name: true, unit: true } } } }),
    prisma.stockMovement.groupBy({ by: ["ingredientId"], where: { organizationId: user.organizationId, kind: "SALE", createdAt: { gte: weekAgo } }, _sum: { quantity: true } }),
  ]);
  const used = new Map(usage.map((u) => [u.ingredientId, -(u._sum.quantity ?? 0)]));
  return (
    <StockView
      ingredients={ingredients.map((i) => ({ id: i.id, name: i.name, unit: i.unit, stock: i.stock, minStock: i.minStock, cost: i.cost, recipes: i._count.recipeItems, weekUse: used.get(i.id) ?? 0 }))}
      movements={movements.map((m) => ({ id: m.id, name: m.ingredient.name, unit: m.ingredient.unit, kind: m.kind, quantity: m.quantity, note: m.note, createdAt: m.createdAt.toISOString() }))}
    />
  );
}
