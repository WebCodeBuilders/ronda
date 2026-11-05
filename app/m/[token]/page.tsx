import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { loadMenu } from "@/lib/orders/queries";
import { QrMenu } from "./QrMenu";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await prisma.diningTable.findUnique({ where: { qrToken: token }, select: { organization: { select: { name: true } } } });
  return { title: t ? `Carta · ${t.organization.name}` : "Carta" };
}

/** La carta que ve el cliente al escanear el QR de su mesa. Pública, sin login. */
export default async function QrPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const table = await prisma.diningTable.findUnique({ where: { qrToken: token }, include: { organization: true } });
  if (!table || !table.active) notFound();
  const org = table.organization;
  const [menu, order] = await Promise.all([
    loadMenu(org.id, { qrOnly: true }),
    prisma.order.findFirst({ where: { tableId: table.id, status: { in: ["OPEN", "BILLING"] } }, include: { items: { where: { status: { not: "VOID" } }, select: { name: true, quantity: true, total: true, status: true } } } }),
  ]);
  return (
    <QrMenu
      token={token}
      orgName={org.name}
      tableName={table.name}
      orderingEnabled={org.qrOrderingEnabled}
      needsApproval={org.qrOrderNeedsApproval}
      menu={{ ...menu, products: menu.products.filter((p) => p.available) }}
      current={order ? { total: order.total, items: order.items } : null}
    />
  );
}
