import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { loadMenu, loadOrderDetail } from "@/lib/orders/queries";
import { OrderScreen } from "@/components/order/OrderScreen";

export const metadata = { title: "Pedido · ronda" };
export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser("salon.view", "orders.create", "orders.charge", "reports.view", "delivery.manage");
  const { id } = await params;
  const orgId = user.organizationId;
  const [order, menu, methods, tables, staff, org, cash] = await Promise.all([
    loadOrderDetail(orgId, id),
    loadMenu(orgId),
    prisma.paymentMethod.findMany({ where: { organizationId: orgId, active: true }, orderBy: { sort: "asc" }, select: { id: true, name: true, kind: true, adjustPct: true } }),
    prisma.diningTable.findMany({
      where: { organizationId: orgId, active: true },
      select: { id: true, name: true, area: { select: { name: true } }, orders: { where: { status: { in: ["OPEN", "BILLING"] } }, select: { id: true, paidAmount: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({ where: { organizationId: orgId, active: true, role: { in: ["WAITER", "MANAGER", "OWNER", "CASHIER", "DELIVERY"] } }, select: { id: true, name: true, role: true }, orderBy: { name: "asc" } }),
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { suggestedTipPct: true, serviceChargePerGuest: true, voidNeedsManager: true } }),
    prisma.cashSession.findFirst({ where: { organizationId: orgId, closedAt: null }, select: { id: true } }),
  ]);
  if (!order) notFound();
  const p = user.permissions;
  return (
    <OrderScreen
      order={order}
      menu={menu}
      methods={methods}
      tables={tables.map((t) => ({ id: t.id, name: t.name, area: t.area.name, orderId: t.orders[0]?.id ?? null, hasPayments: (t.orders[0]?.paidAmount ?? 0) > 0 }))}
      staff={staff}
      settings={{ suggestedTipPct: org.suggestedTipPct, cashOpen: !!cash }}
      can={{
        edit: p.has("orders.edit"),
        send: p.has("orders.send"),
        void: p.has("orders.void") || !org.voidNeedsManager,
        discount: p.has("orders.discount"),
        transfer: p.has("orders.transfer"),
        charge: p.has("orders.charge"),
        cancel: p.has("orders.cancel"),
        reopen: p.has("orders.reopen"),
        delivery: p.has("delivery.manage"),
      }}
    />
  );
}
