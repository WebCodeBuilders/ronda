import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { DeliveryBoard } from "@/components/delivery/DeliveryBoard";
import { startOfToday } from "@/lib/reports";

export const metadata = { title: "Delivery y retiro · ronda" };
export const dynamic = "force-dynamic";

export default async function DeliveryPage() {
  const user = await pageUser("delivery.manage");
  const orgId = user.organizationId;
  const today = startOfToday();
  const onlyMine = user.role === "DELIVERY";
  const [orders, couriers, org] = await Promise.all([
    prisma.order.findMany({
      where: {
        organizationId: orgId,
        fulfillment: { not: null },
        status: { not: "CANCELLED" },
        // Lo que está en curso (de las últimas 24 h) y lo entregado hoy.
        OR: [
          { fulfillment: { in: ["PENDING", "PREPARING", "READY", "ON_THE_WAY"] }, openedAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
          { fulfillment: "DELIVERED", openedAt: { gte: today } },
        ],
        ...(onlyMine ? { courierId: user.id } : {}),
      },
      orderBy: { openedAt: "asc" },
      take: 150,
      include: { courier: { select: { id: true, name: true } }, items: { where: { status: { not: "VOID" } }, select: { name: true, quantity: true, status: true } } },
    }),
    prisma.user.findMany({ where: { organizationId: orgId, active: true, role: { in: ["DELIVERY", "WAITER"] } }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } }),
  ]);
  return (
    <DeliveryBoard
      orgName={org.name}
      couriers={couriers}
      orders={orders.map((o) => ({
        id: o.id, number: o.number, type: o.type, status: o.status, fulfillment: o.fulfillment!, customerName: o.customerName, customerPhone: o.customerPhone,
        deliveryAddress: o.deliveryAddress, total: o.total, paid: o.paidAmount, openedAt: o.openedAt.toISOString(), scheduledFor: o.scheduledFor?.toISOString() ?? null,
        courier: o.courier, items: o.items.map((i) => ({ name: i.name, quantity: i.quantity, status: i.status })),
      }))}
    />
  );
}
