import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { tableCls } from "@/components/ui";
import { formatCurrency, formatDate, cn } from "@/lib/utils";

export const metadata = { title: "Historial · ronda" };
export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; actions: string[] }[] = [
  { key: "todo", label: "Todo", actions: [] },
  { key: "anulaciones", label: "Anulaciones", actions: ["item.void", "order.cancel", "payment.refund"] },
  { key: "descuentos", label: "Descuentos", actions: ["order.discount"] },
  { key: "caja", label: "Caja", actions: ["cash.open", "cash.close", "cash.in", "cash.out"] },
  { key: "precios", label: "Precios y carta", actions: ["product.price", "product.bulk_price", "product.availability"] },
  { key: "mesas", label: "Mesas", actions: ["order.transfer", "order.merge", "order.reopen", "order.waiter"] },
];

export default async function Page({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const user = await pageUser("settings.manage", "reports.view");
  const sp = await searchParams;
  const filter = FILTERS.find((f) => f.key === sp.f) ?? FILTERS[0]!;
  const logs = await prisma.auditLog.findMany({
    where: { organizationId: user.organizationId, ...(filter.actions.length ? { action: { in: filter.actions } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true } } },
  });
  return (
    <PageContainer width="wide">
      <PageHeader title="Historial" back={{ href: "/configuracion", label: "Configuración" }} description="Lo sensible queda registrado: quién lo hizo, cuándo y por qué." />
      <div className="snap-x-chips gap-2 mb-3">
        {FILTERS.map((f) => (
          <Link key={f.key} href={`/configuracion/historial?f=${f.key}`} className={cn("h-9 px-3 rounded-xl border text-sm font-semibold flex items-center", f.key === filter.key ? "bg-accent-light text-accent border-accent" : "border-border bg-surface text-text-secondary")}>{f.label}</Link>
        ))}
      </div>
      <div className={tableCls.frame}>
        <div className={tableCls.scroll}>
          <table className={tableCls.table}>
            <thead className={tableCls.thead}><tr><th className={tableCls.th}>Cuándo</th><th className={tableCls.th}>Quién</th><th className={tableCls.th}>Qué</th><th className={cn(tableCls.th, tableCls.thRight)}>Importe</th></tr></thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className={tableCls.tr}>
                  <td className={cn(tableCls.td, "whitespace-nowrap tabular-nums")}>{formatDate(l.createdAt)}</td>
                  <td className={cn(tableCls.td, "whitespace-nowrap")}>{l.user?.name ?? "Sistema"}</td>
                  <td className={tableCls.td}>{l.entity === "order" && l.entityId ? <Link href={`/pedidos/${l.entityId}`} className="hover:underline">{l.summary}</Link> : l.summary}</td>
                  <td className={cn(tableCls.td, tableCls.tdRight)}>{l.amount !== null && l.action !== "settings.update" ? (l.action === "product.bulk_price" ? `${l.amount} %` : formatCurrency(l.amount)) : "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={4} className={cn(tableCls.td, "py-8 text-center text-text-secondary")}>Nada registrado con este filtro.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
