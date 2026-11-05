import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { CustomerDetail } from "@/components/customers/CustomerDetail";

export const metadata = { title: "Cliente · ronda" };
export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const user = await pageUser("customers.manage");
  const { id } = await params;
  const c = await prisma.customer.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!c) notFound();
  const [orders, payments, methods, top] = await Promise.all([
    prisma.order.findMany({ where: { customerId: id }, orderBy: { openedAt: "desc" }, take: 50, select: { id: true, number: true, type: true, status: true, total: true, openedAt: true, table: { select: { name: true } } } }),
    prisma.payment.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 30, include: { method: { select: { name: true, kind: true } } } }),
    prisma.paymentMethod.findMany({ where: { organizationId: user.organizationId, active: true, kind: { not: "ACCOUNT" } }, orderBy: { sort: "asc" }, select: { id: true, name: true } }),
    prisma.orderItem.groupBy({ by: ["name"], where: { order: { customerId: id, status: "PAID" }, status: { not: "VOID" } }, _sum: { quantity: true }, orderBy: { _sum: { quantity: "desc" } }, take: 5 }),
  ]);
  const paid = orders.filter((o) => o.status === "PAID");
  return (
    <CustomerDetail
      customer={{ id: c.id, name: c.name, phone: c.phone ?? "", email: c.email ?? "", address: c.address ?? "", addressNotes: c.addressNotes ?? "", notes: c.notes ?? "", birthday: c.birthday ? c.birthday.toISOString().slice(0, 10) : "", creditLimit: c.creditLimit, tags: c.tags, balance: c.balance, points: c.points }}
      stats={{ visits: paid.length, spent: paid.reduce((s, o) => s + o.total, 0), avg: paid.length ? paid.reduce((s, o) => s + o.total, 0) / paid.length : 0, last: paid[0]?.openedAt.toISOString() ?? null }}
      favorites={top.map((t) => ({ name: t.name, quantity: t._sum.quantity ?? 0 }))}
      orders={orders.map((o) => ({ ...o, openedAt: o.openedAt.toISOString(), table: o.table?.name ?? null }))}
      movements={payments.map((p) => ({ id: p.id, method: p.method.name, kind: p.method.kind, amount: p.amount, createdAt: p.createdAt.toISOString(), orderId: p.orderId }))}
      methods={methods}
      canCharge={user.permissions.has("orders.charge")}
    />
  );
}
