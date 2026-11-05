import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge, tableCls } from "@/components/ui";
import { OrdersFilters } from "@/components/orders/OrdersFilters";
import { rangeFromParams } from "@/lib/reports";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, ORDER_TYPE_LABEL, orderLabel } from "@/lib/orders/labels";
import { formatCurrency, formatDate, formatTime, cn } from "@/lib/utils";

export const metadata = { title: "Pedidos · ronda" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ q?: string; estado?: string; tipo?: string; desde?: string; hasta?: string; mozo?: string }> }) {
  const user = await pageUser("orders.charge", "reports.view");
  const sp = await searchParams;
  const range = rangeFromParams(sp.desde, sp.hasta, 1);
  const num = sp.q && /^\d+$/.test(sp.q) ? Number(sp.q) : null;
  const where = {
    organizationId: user.organizationId,
    ...(num ? { number: num } : { openedAt: { gte: range.from, lt: range.to } }),
    ...(sp.estado ? { status: sp.estado } : {}),
    ...(sp.tipo ? { type: sp.tipo } : {}),
    ...(sp.mozo ? { waiterId: sp.mozo } : {}),
    ...(sp.q && !num ? { OR: [{ customerName: { contains: sp.q, mode: "insensitive" as const } }, { customer: { name: { contains: sp.q, mode: "insensitive" as const } } }, { table: { name: sp.q } }] } : {}),
  };
  const [orders, agg, waiters] = await Promise.all([
    prisma.order.findMany({ where, orderBy: { openedAt: "desc" }, take: 300, include: { table: { select: { name: true } }, waiter: { select: { name: true } }, customer: { select: { name: true } } } }),
    prisma.order.aggregate({ where: { ...where, status: "PAID" }, _sum: { total: true }, _count: true }),
    prisma.user.findMany({ where: { organizationId: user.organizationId, role: { in: ["WAITER", "CASHIER", "MANAGER", "OWNER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <PageContainer width="full">
      <PageHeader title="Pedidos" meta={<span className="text-sm text-text-secondary tabular-nums">{agg._count} cobrados · {formatCurrency(agg._sum.total ?? 0)}</span>} />
      <OrdersFilters initial={sp} waiters={waiters} />
      {/* Celular: una tarjeta por pedido. */}
      <div className="md:hidden rounded-2xl border border-border bg-surface divide-y divide-border">
        {orders.map((o) => (
          <Link key={o.id} href={`/pedidos/${o.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-secondary">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-text-primary truncate">{orderLabel(o)}</p>
              <p className="text-xs text-text-muted truncate">N° {o.number} · {formatTime(o.openedAt)}{o.waiter ? ` · ${o.waiter.name}` : ""}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className="text-sm font-semibold tabular-nums">{formatCurrency(o.total)}</span>
              <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
            </div>
          </Link>
        ))}
        {orders.length === 0 && <p className="px-4 py-10 text-center text-sm text-text-secondary">No hay pedidos con estos filtros.</p>}
      </div>
      <div className={cn(tableCls.frame, "hidden md:block")}>
        <div className={tableCls.scroll}>
          <table className={tableCls.table}>
            <thead className={tableCls.thead}>
              <tr>
                <th className={tableCls.th}>N°</th><th className={tableCls.th}>Pedido</th><th className={cn(tableCls.th, "hidden md:table-cell")}>Mozo</th>
                <th className={cn(tableCls.th, "hidden sm:table-cell")}>Abierto</th><th className={tableCls.th}>Estado</th><th className={cn(tableCls.th, tableCls.thRight)}>Total</th><th className={tableCls.th} />
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className={cn(tableCls.tr, tableCls.trClickable)}>
                  <td className={cn(tableCls.td, "tabular-nums")}><Link href={`/pedidos/${o.id}`} className="block">{o.number}</Link></td>
                  <td className={tableCls.td}><Link href={`/pedidos/${o.id}`} className="block">{orderLabel(o)}{(o.customer || o.source === "QR" || !o.table) && <div className={tableCls.sub}>{[!o.table ? null : null, o.customer?.name, o.source === "QR" ? "Pedido por QR" : null].filter(Boolean).join(" · ") || ORDER_TYPE_LABEL[o.type]}</div>}</Link></td>
                  <td className={cn(tableCls.td, tableCls.tdMuted, "hidden md:table-cell")}>{o.waiter?.name ?? "—"}</td>
                  <td className={cn(tableCls.td, tableCls.tdMuted, "hidden sm:table-cell tabular-nums whitespace-nowrap")}>{formatDate(o.openedAt)}</td>
                  <td className={tableCls.td}><Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge></td>
                  <td className={cn(tableCls.td, tableCls.tdRight, "font-semibold")}>{formatCurrency(o.total)}</td>
                  <td className={cn(tableCls.td, "w-4")} />
                </tr>
              ))}
              {orders.length === 0 && <tr><td colSpan={7} className={cn(tableCls.td, "py-10 text-center text-text-secondary")}>No hay pedidos con estos filtros.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
