import "server-only";
import { prisma } from "@/lib/prisma";
import { orderLabel } from "@/lib/orders/labels";

export type KdsTicket = {
  id: string;
  number: number;
  status: string;
  priority: boolean;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  stationId: string;
  stationName: string;
  orderId: string;
  orderType: string;
  label: string;
  waiter: string | null;
  guests: number;
  notes: string | null;
  items: { id: string; quantity: number; name: string; modifiers: string[]; notes: string | null; course: number; seat: number | null; status: string }[];
  held: { quantity: number; name: string; course: number }[];
};

export type KdsData = {
  stations: { id: string; name: string; color: string }[];
  tickets: KdsTicket[];
  lateMinutes: number;
  allDay: { name: string; quantity: number }[];
};

export async function loadKitchen(orgId: string, stationId: string | null): Promise<KdsData> {
  const since = new Date(Date.now() - 30 * 60_000);
  const [org, stations, tickets] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { kitchenLateMinutes: true } }),
    prisma.station.findMany({ where: { organizationId: orgId, active: true, kdsEnabled: true }, orderBy: { sort: "asc" }, select: { id: true, name: true, color: true } }),
    prisma.kitchenTicket.findMany({
      where: {
        organizationId: orgId,
        ...(stationId ? { stationId } : {}),
        OR: [{ status: { in: ["NEW", "PREPARING"] } }, { status: "READY", readyAt: { gte: since } }],
      },
      include: {
        station: { select: { name: true } },
        items: { orderBy: [{ course: "asc" }, { createdAt: "asc" }] },
        order: { include: { table: { select: { name: true } }, waiter: { select: { name: true } } } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 120,
    }),
  ]);
  const orderIds = [...new Set(tickets.map((t) => t.orderId))];
  const held = orderIds.length
    ? await prisma.orderItem.findMany({ where: { orderId: { in: orderIds }, status: "HOLD", ...(stationId ? { stationId } : {}) }, select: { orderId: true, stationId: true, quantity: true, name: true, course: true } })
    : [];

  const allDay = new Map<string, number>();
  for (const t of tickets) {
    if (t.status === "READY") continue;
    for (const i of t.items) if (["SENT", "PREPARING"].includes(i.status)) allDay.set(i.name, (allDay.get(i.name) ?? 0) + i.quantity);
  }

  return {
    stations,
    lateMinutes: org.kitchenLateMinutes,
    allDay: [...allDay.entries()].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => b.quantity - a.quantity),
    tickets: tickets.map((t) => ({
      id: t.id,
      number: t.number,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
      startedAt: t.startedAt?.toISOString() ?? null,
      readyAt: t.readyAt?.toISOString() ?? null,
      stationId: t.stationId,
      stationName: t.station.name,
      orderId: t.orderId,
      orderType: t.order.type,
      label: orderLabel(t.order),
      waiter: t.order.waiter?.name ?? null,
      guests: t.order.guests,
      notes: t.order.notes,
      items: t.items.map((i) => ({
        id: i.id,
        quantity: i.quantity,
        name: i.name,
        modifiers: ((i.modifiers as { name: string }[]) ?? []).map((m) => m.name),
        notes: i.notes,
        course: i.course,
        seat: i.seat,
        status: i.status,
      })),
      held: held.filter((h) => h.orderId === t.orderId && h.stationId === t.stationId).map((h) => ({ quantity: h.quantity, name: h.name, course: h.course })),
    })),
  };
}
