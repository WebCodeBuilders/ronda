import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { ProductForm } from "@/components/menu/ProductForm";

export const metadata = { title: "Producto · ronda" };
export const dynamic = "force-dynamic";

export default async function ProductPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ categoria?: string }> }) {
  const user = await pageUser("menu.manage");
  const orgId = user.organizationId;
  const { id } = await params;
  const sp = await searchParams;
  const [product, categories, stations, groups, ingredients] = await Promise.all([
    id === "nuevo" ? null : prisma.product.findFirst({ where: { id, organizationId: orgId }, include: { modifierGroups: true, recipe: true } }),
    prisma.category.findMany({ where: { organizationId: orgId, active: true }, orderBy: { sort: "asc" }, select: { id: true, name: true, stationId: true } }),
    prisma.station.findMany({ where: { organizationId: orgId, active: true }, orderBy: { sort: "asc" }, select: { id: true, name: true } }),
    prisma.modifierGroup.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" }, include: { options: { select: { name: true }, orderBy: { sort: "asc" } } } }),
    prisma.ingredient.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, unit: true, cost: true } }),
  ]);
  if (id !== "nuevo" && !product) notFound();
  return (
    <ProductForm
      initial={
        product
          ? {
              id: product.id, name: product.name, shortName: product.shortName, description: product.description, categoryId: product.categoryId, stationId: product.stationId,
              price: product.price, cost: product.cost, course: product.course, prepMinutes: product.prepMinutes, available: product.available, showInQrMenu: product.showInQrMenu,
              skipKitchen: product.skipKitchen, openPrice: product.openPrice, imageUrl: product.imageUrl, tags: product.tags,
              modifierGroupIds: product.modifierGroups.sort((a, b) => a.sort - b.sort).map((g) => g.groupId), recipe: product.recipe.map((r) => ({ ingredientId: r.ingredientId, quantity: r.quantity })),
            }
          : null
      }
      defaultCategoryId={sp.categoria ?? categories[0]?.id ?? null}
      categories={categories}
      stations={stations}
      groups={groups.map((g) => ({ id: g.id, name: g.name, summary: g.options.map((o) => o.name).join(", ") }))}
      ingredients={ingredients}
    />
  );
}
