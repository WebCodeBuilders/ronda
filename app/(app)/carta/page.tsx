import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { MenuAdmin } from "@/components/menu/MenuAdmin";

export const metadata = { title: "Carta · ronda" };
export const dynamic = "force-dynamic";

export default async function MenuPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await pageUser("menu.manage", "menu.availability");
  const orgId = user.organizationId;
  const sp = await searchParams;
  const [categories, products, groups, stations] = await Promise.all([
    prisma.category.findMany({ where: { organizationId: orgId, active: true }, orderBy: { sort: "asc" }, include: { station: { select: { name: true } }, _count: { select: { products: { where: { active: true } } } } } }),
    prisma.product.findMany({ where: { organizationId: orgId, active: true }, orderBy: [{ sort: "asc" }, { name: "asc" }], include: { station: { select: { name: true } }, category: { select: { stationId: true, station: { select: { name: true } } } } } }),
    prisma.modifierGroup.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" }, include: { options: { orderBy: { sort: "asc" } }, _count: { select: { products: true } } } }),
    prisma.station.findMany({ where: { organizationId: orgId, active: true }, orderBy: { sort: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <MenuAdmin
      tab={sp.tab === "categorias" || sp.tab === "opciones" ? sp.tab : "productos"}
      canManage={user.permissions.has("menu.manage")}
      stations={stations}
      categories={categories.map((c) => ({ id: c.id, name: c.name, color: c.color, stationId: c.stationId, stationName: c.station?.name ?? null, count: c._count.products }))}
      products={products.map((p) => ({
        id: p.id, name: p.name, categoryId: p.categoryId, price: p.price, cost: p.cost, available: p.available, showInQrMenu: p.showInQrMenu,
        station: p.station?.name ?? p.category?.station?.name ?? null, tags: p.tags, openPrice: p.openPrice,
      }))}
      groups={groups.map((g) => ({ id: g.id, name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, products: g._count.products, options: g.options.map((o) => ({ id: o.id, name: o.name, priceDelta: o.priceDelta, available: o.available })) }))}
    />
  );
}
