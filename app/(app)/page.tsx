import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { homeFor } from "@/lib/auth/home";
import { salesReport, startOfToday } from "@/lib/reports";
import { HomeDashboard } from "@/components/home/HomeDashboard";

export const metadata = { title: "Inicio · ronda" };
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await pageUser();
  if (!user.permissions.has("reports.view") && !user.permissions.has("cash.manage")) {
    const home = homeFor({ role: user.role });
    redirect(home === "/" ? "/salon" : home);
  }
  const orgId = user.organizationId;
  const today = startOfToday();
  const lastWeek = new Date(today.getTime() - 7 * 86_400_000);
  const now = new Date();
  const lastWeekNow = new Date(now.getTime() - 7 * 86_400_000);
  const [rToday, rLastWeek, openOrders, tables, kitchen, lowStock, reservations, waitlist, printFails, cash, org] = await Promise.all([
    salesReport(orgId, { from: today, to: new Date(today.getTime() + 86_400_000) }),
    salesReport(orgId, { from: lastWeek, to: lastWeekNow }),
    prisma.order.findMany({ where: { organizationId: orgId, status: { in: ["OPEN", "BILLING"] } }, select: { total: true, guests: true, type: true } }),
    prisma.diningTable.count({ where: { organizationId: orgId, active: true } }),
    prisma.kitchenTicket.findMany({ where: { organizationId: orgId, status: { in: ["NEW", "PREPARING"] } }, select: { createdAt: true } }),
    prisma.$queryRaw<{ id: string; name: string; stock: number; minStock: number; unit: string }[]>`SELECT id, name, stock, "minStock", unit FROM "Ingredient" WHERE "organizationId" = ${orgId} AND active = true AND stock <= "minStock" ORDER BY (stock / NULLIF("minStock", 0)) ASC NULLS LAST LIMIT 8`,
    prisma.reservation.findMany({ where: { organizationId: orgId, kind: "RESERVATION", status: { in: ["PENDING", "CONFIRMED"] }, dateTime: { gte: new Date(now.getTime() - 30 * 60_000), lte: new Date(today.getTime() + 86_400_000) } }, orderBy: { dateTime: "asc" }, take: 6, include: { table: { select: { name: true } } } }),
    prisma.reservation.count({ where: { organizationId: orgId, kind: "WAITLIST", status: "PENDING" } }),
    prisma.printJob.count({ where: { organizationId: orgId, status: "FAILED", createdAt: { gte: today } } }),
    prisma.cashSession.findFirst({ where: { organizationId: orgId, closedAt: null }, select: { openedAt: true } }),
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { kitchenLateMinutes: true, name: true } }),
  ]);
  const lateCutoff = now.getTime() - org.kitchenLateMinutes * 60_000;
  return (
    <HomeDashboard
      userName={user.name.split(" ")[0]!}
      today={rToday}
      lastWeek={rLastWeek.totals}
      live={{
        openOrders: openOrders.length,
        openTotal: openOrders.reduce((s, o) => s + o.total, 0),
        busyTables: openOrders.filter((o) => o.type === "DINE_IN" || o.type === "QR").length,
        tables,
        guests: openOrders.filter((o) => o.type === "DINE_IN" || o.type === "QR").reduce((s, o) => s + o.guests, 0),
        kitchen: kitchen.length,
        late: kitchen.filter((k) => k.createdAt.getTime() < lateCutoff).length,
        waitlist,
        printFails,
        cashOpen: !!cash,
      }}
      lowStock={lowStock}
      reservations={reservations.map((r) => ({ id: r.id, name: r.name, partySize: r.partySize, dateTime: r.dateTime.toISOString(), table: r.table?.name ?? null, notes: r.notes }))}
    />
  );
}
