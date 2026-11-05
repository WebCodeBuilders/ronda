import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { cashSummary } from "@/lib/cash";
import { CashView } from "@/components/cash/CashView";

export const metadata = { title: "Caja · ronda" };
export const dynamic = "force-dynamic";

export default async function CashPage({ searchParams }: { searchParams: Promise<{ turno?: string }> }) {
  const user = await pageUser("cash.manage");
  const orgId = user.organizationId;
  const sp = await searchParams;
  const open = await prisma.cashSession.findFirst({ where: { organizationId: orgId, closedAt: null }, select: { id: true } });
  const viewing = sp.turno ? await prisma.cashSession.findFirst({ where: { id: sp.turno, organizationId: orgId }, select: { id: true } }) : open;
  const [summary, history, openOrders] = await Promise.all([
    viewing ? cashSummary(viewing.id) : null,
    prisma.cashSession.findMany({
      where: { organizationId: orgId, closedAt: { not: null } },
      orderBy: { openedAt: "desc" },
      take: 15,
      include: { openedBy: { select: { name: true } }, payments: { select: { amount: true } } },
    }),
    prisma.order.count({ where: { organizationId: orgId, status: { in: ["OPEN", "BILLING"] } } }),
  ]);
  return (
    <CashView
      summary={summary}
      isOpen={!!open && viewing?.id === open.id}
      hasOpen={!!open}
      openOrders={openOrders}
      history={history.map((h) => ({
        id: h.id, openedAt: h.openedAt.toISOString(), closedAt: h.closedAt!.toISOString(), openedBy: h.openedBy.name,
        sales: h.payments.reduce((s, p) => s + p.amount, 0), difference: h.difference ?? 0,
      }))}
    />
  );
}
