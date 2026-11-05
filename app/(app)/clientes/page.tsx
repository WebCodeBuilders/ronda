import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge, tableCls } from "@/components/ui";
import { NewCustomerButton } from "@/components/customers/NewCustomerButton";
import { formatCurrency, formatDay, cn } from "@/lib/utils";
import { initials } from "@/lib/colors";

export const metadata = { title: "Clientes · ronda" };
export const dynamic = "force-dynamic";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  const user = await pageUser("customers.manage");
  const sp = await searchParams;
  const q = sp.q?.trim();
  const customers = await prisma.customer.findMany({
    where: {
      organizationId: user.organizationId,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }, { email: { contains: q, mode: "insensitive" } }] } : {}),
      ...(sp.f === "deuda" ? { balance: { gt: 0 } } : {}),
    },
    orderBy: sp.f === "deuda" ? { balance: "desc" } : { updatedAt: "desc" },
    take: 200,
  });
  const stats = await prisma.order.groupBy({ by: ["customerId"], where: { organizationId: user.organizationId, status: "PAID", customerId: { in: customers.map((c) => c.id) } }, _sum: { total: true }, _count: true, _max: { closedAt: true } });
  const byId = new Map(stats.map((s) => [s.customerId, s]));
  return (
    <PageContainer width="wide">
      <PageHeader title="Clientes" action={<NewCustomerButton />} />
      <form className="flex flex-wrap gap-2 mb-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input name="q" defaultValue={q} placeholder="Nombre, teléfono o email" className="w-full h-11 pl-9 pr-3 rounded-2xl border border-border bg-surface text-base lg:text-sm outline-none focus:border-accent" />
        </div>
        <Link href="/clientes" className={cn("h-11 px-4 rounded-2xl border text-sm font-semibold flex items-center", sp.f !== "deuda" ? "bg-accent-light text-accent border-accent" : "border-border bg-surface text-text-secondary")}>Todos</Link>
        <Link href="/clientes?f=deuda" className={cn("h-11 px-4 rounded-2xl border text-sm font-semibold flex items-center", sp.f === "deuda" ? "bg-accent-light text-accent border-accent" : "border-border bg-surface text-text-secondary")}>Con deuda</Link>
      </form>
      {/* Celular: tarjetas con iniciales, visitas y deuda. */}
      <div className="md:hidden rounded-2xl border border-border bg-surface divide-y divide-border">
        {customers.map((c) => {
          const st = byId.get(c.id);
          return (
            <Link key={c.id} href={`/clientes/${c.id}`} className="flex items-center gap-3 px-4 py-3 active:bg-surface-secondary">
              <span className="w-10 h-10 rounded-full bg-accent-light text-accent text-sm font-semibold flex items-center justify-center shrink-0">{initials(c.name)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold text-text-primary truncate">{c.name}</p>
                <p className="text-xs text-text-muted truncate">{st?._count ?? 0} visitas{c.phone ? ` · ${c.phone}` : ""}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold tabular-nums">{formatCurrency(st?._sum.total ?? 0)}</p>
                {c.balance > 0 && <p className="text-xs font-semibold text-error tabular-nums">Debe {formatCurrency(c.balance)}</p>}
              </div>
            </Link>
          );
        })}
        {customers.length === 0 && <p className="px-4 py-10 text-center text-sm text-text-secondary">{q ? "Nadie con esa búsqueda." : "Todavía no hay clientes."}</p>}
      </div>
      <div className={cn(tableCls.frame, "hidden md:block")}>
        <div className={tableCls.scroll}>
          <table className={tableCls.table}>
            <thead className={tableCls.thead}><tr><th className={tableCls.th}>Cliente</th><th className={cn(tableCls.th, "hidden sm:table-cell")}>Visitas</th><th className={cn(tableCls.th, "hidden md:table-cell")}>Última</th><th className={cn(tableCls.th, tableCls.thRight)}>Consumió</th><th className={cn(tableCls.th, tableCls.thRight)}>Debe</th><th className={tableCls.th} /></tr></thead>
            <tbody>
              {customers.map((c) => {
                const s = byId.get(c.id);
                return (
                  <tr key={c.id} className={cn(tableCls.tr, tableCls.trClickable)}>
                    <td className={tableCls.td}><Link href={`/clientes/${c.id}`} className="block">{c.name} {c.tags.map((t) => <Badge key={t} tone="violet" className="ml-1">{t}</Badge>)}<div className={tableCls.sub}>{c.phone ?? "Sin teléfono"}{c.notes ? ` · ${c.notes}` : ""}</div></Link></td>
                    <td className={cn(tableCls.td, "hidden sm:table-cell tabular-nums")}>{s?._count ?? 0}</td>
                    <td className={cn(tableCls.td, tableCls.tdMuted, "hidden md:table-cell")}>{s?._max.closedAt ? formatDay(s._max.closedAt) : "—"}</td>
                    <td className={cn(tableCls.td, tableCls.tdRight)}>{formatCurrency(s?._sum.total ?? 0)}</td>
                    <td className={cn(tableCls.td, tableCls.tdRight, c.balance > 0 ? "text-error font-semibold" : "text-text-muted")}>{c.balance > 0 ? formatCurrency(c.balance) : "—"}</td>
                    <td className={cn(tableCls.td, "w-4")} />
                  </tr>
                );
              })}
              {customers.length === 0 && <tr><td colSpan={6} className={cn(tableCls.td, "py-10 text-center text-text-secondary")}>{q ? "Nadie con esa búsqueda." : "Todavía no hay clientes. Se crean solos al cargar un delivery o al asignarlos a una mesa."}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
