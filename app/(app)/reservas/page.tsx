import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { rangeFromParams } from "@/lib/reports";
import { ReservationsView } from "@/components/reservations/ReservationsView";

export const metadata = { title: "Reservas · ronda" };
export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ dia?: string }> }) {
  const user = await pageUser("reservations.manage");
  const sp = await searchParams;
  const day = sp.dia ?? new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const range = rangeFromParams(day, day);
  const [reservations, waitlist, tables] = await Promise.all([
    prisma.reservation.findMany({ where: { organizationId: user.organizationId, kind: "RESERVATION", dateTime: { gte: range.from, lt: range.to } }, orderBy: { dateTime: "asc" }, include: { table: { select: { name: true } } } }),
    prisma.reservation.findMany({ where: { organizationId: user.organizationId, kind: "WAITLIST", status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.diningTable.findMany({ where: { organizationId: user.organizationId, active: true }, select: { id: true, name: true, seats: true, area: { select: { name: true } }, orders: { where: { status: { in: ["OPEN", "BILLING"] } }, select: { id: true } } }, orderBy: { name: "asc" } }),
  ]);
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { name: true } });
  const ser = (r: (typeof reservations)[number] | (typeof waitlist)[number]) => ({
    id: r.id, name: r.name, phone: r.phone, partySize: r.partySize, dateTime: r.dateTime.toISOString(), status: r.status, notes: r.notes, quotedMinutes: r.quotedMinutes,
    areaPreference: r.areaPreference, createdAt: r.createdAt.toISOString(), tableId: r.tableId, table: "table" in r && r.table ? (r.table as { name: string }).name : null,
  });
  return (
    <ReservationsView
      orgName={org.name}
      day={day}
      reservations={reservations.map(ser)}
      waitlist={waitlist.map(ser)}
      tables={tables.map((t) => ({ id: t.id, name: t.name, seats: t.seats, area: t.area.name, busy: t.orders.length > 0 }))}
    />
  );
}
