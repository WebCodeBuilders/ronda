import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { CounterStart } from "@/components/counter/CounterStart";

export const metadata = { title: "Mostrador · ronda" };
export const dynamic = "force-dynamic";

export default async function CounterPage() {
  const user = await pageUser("orders.create");
  const recent = await prisma.order.findMany({
    where: { organizationId: user.organizationId, type: { in: ["COUNTER", "TAKEAWAY", "DELIVERY"] }, status: { in: ["OPEN", "BILLING"] } },
    orderBy: { openedAt: "desc" },
    take: 12,
    select: { id: true, number: true, type: true, customerName: true, total: true, paidAmount: true, openedAt: true, fulfillment: true, items: { select: { status: true } } },
  });
  return (
    <CounterStart
      recent={recent.map((o) => ({ id: o.id, number: o.number, type: o.type, customerName: o.customerName, total: o.total, paid: o.paidAmount, openedAt: o.openedAt.toISOString(), fulfillment: o.fulfillment, drafts: o.items.filter((i) => i.status === "DRAFT").length }))}
    />
  );
}
