import Link from "next/link";
import { ChevronRight, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge, tableCls } from "@/components/ui";
import { NewCustomerButton } from "@/components/customers/NewCustomerButton";
import { formatCurrency, formatDay, cn } from "@/lib/utils";

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
      <div className={tableCls.frame}>
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
                    <td className={cn(tableCls.td, "w-8")}><Link href={`/clientes/${c.id}`} aria-label="Ver"><ChevronRight className="w-4 h-4 text-text-muted" /></Link></td>
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
