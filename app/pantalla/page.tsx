import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getDevice } from "@/lib/auth/session";
import { PickupDisplay } from "./PickupDisplay";

export const metadata = { title: "Pedidos listos · ronda" };
export const dynamic = "force-dynamic";

/** Pantalla para los clientes: qué número se está preparando y cuál ya se puede retirar. */
export default async function PickupPage() {
  const user = await getCurrentUser();
  const device = user ? null : await getDevice();
  const orgId = user?.organizationId ?? (device?.kind === "DISPLAY" || device?.kind === "KDS" ? device.organizationId : null);
  if (!orgId) redirect("/login?next=/pantalla");
  const since = new Date(Date.now() - 20 * 60_000);
  const [org, orders] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } }),
    prisma.order.findMany({
      where: {
        organizationId: orgId,
        type: { in: ["TAKEAWAY", "COUNTER"] },
        status: { not: "CANCELLED" },
        OR: [{ fulfillment: { in: ["PENDING", "PREPARING", "READY"] } }],
        openedAt: { gte: new Date(Date.now() - 12 * 3600_000) },
      },
      select: { id: true, number: true, customerName: true, fulfillment: true, updatedAt: true, items: { select: { status: true } } },
      orderBy: { number: "asc" },
    }),
  ]);
  void since;
  return (
    <PickupDisplay
      orgName={org.name}
      preparing={orders.filter((o) => o.fulfillment !== "READY" && o.items.some((i) => i.status !== "DRAFT")).map((o) => ({ number: o.number, name: o.customerName }))}
      ready={orders.filter((o) => o.fulfillment === "READY").map((o) => ({ number: o.number, name: o.customerName }))}
    />
  );
}
