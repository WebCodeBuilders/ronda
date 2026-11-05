import "server-only";
import { prisma } from "@/lib/prisma";
import { tableState, type TableState } from "./state";

export type SalonTable = {
  id: string;
  name: string;
  areaId: string;
  shape: string;
  seats: number;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  state: TableState;
  order: null | {
    id: string;
    number: number;
    guests: number;
    total: number;
    openedAt: string;
    waiterId: string | null;
    waiterName: string | null;
    waiterColor: string | null;
    readyItems: number;
    draftItems: number;
    heldItems: number;
  };
  reservation: null | { name: string; partySize: number; dateTime: string };
};

export type SalonData = {
  areas: { id: string; name: string; width: number; height: number }[];
  tables: SalonTable[];
  lateMinutes: number;
};

export async function loadSalon(orgId: string): Promise<SalonData> {
  const now = Date.now();
  const [org, areas, tables, orders, requests, reservations] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { kitchenLateMinutes: true } }),
    prisma.area.findMany({ where: { organizationId: orgId, active: true }, orderBy: { sort: "asc" } }),
    prisma.diningTable.findMany({ where: { organizationId: orgId, active: true }, orderBy: { name: "asc" } }),
    prisma.order.findMany({
      where: { organizationId: orgId, status: { in: ["OPEN", "BILLING"] }, tableId: { not: null } },
      include: {
        waiter: { select: { name: true, color: true } },
        items: { select: { status: true } },
        tickets: { where: { status: { in: ["NEW", "PREPARING"] } }, select: { createdAt: true }, orderBy: { createdAt: "asc" }, take: 1 },
      },
    }),
    prisma.serviceRequest.groupBy({ by: ["tableId"], where: { organizationId: orgId, status: { in: ["OPEN"] } }, _count: true }),
    prisma.reservation.findMany({
      where: {
        organizationId: orgId,
        kind: "RESERVATION",
        status: { in: ["PENDING", "CONFIRMED"] },
        tableId: { not: null },
        dateTime: { gte: new Date(now - 30 * 60_000), lte: new Date(now + 90 * 60_000) },
      },
      orderBy: { dateTime: "asc" },
    }),
  ]);
  const orderByTable = new Map(orders.map((o) => [o.tableId!, o]));
  const reqByTable = new Map(requests.map((r) => [r.tableId, r._count]));
  const resByTable = new Map<string, (typeof reservations)[number]>();
  for (const r of reservations) if (!resByTable.has(r.tableId!)) resByTable.set(r.tableId!, r);

  return {
    lateMinutes: org.kitchenLateMinutes,
    areas: areas.map((a) => ({ id: a.id, name: a.name, width: a.width, height: a.height })),
    tables: tables.map((t) => {
      const o = orderByTable.get(t.id);
      const ready = o?.items.filter((i) => i.status === "READY").length ?? 0;
      const draft = o?.items.filter((i) => i.status === "DRAFT").length ?? 0;
      const held = o?.items.filter((i) => i.status === "HOLD").length ?? 0;
      const res = resByTable.get(t.id);
      const state = tableState(
        {
          hasOrder: !!o,
          orderStatus: o?.status,
          readyItems: ready,
          draftItems: draft,
          oldestPendingSentAt: o?.tickets[0]?.createdAt ?? null,
          openRequests: reqByTable.get(t.id) ?? 0,
          reservationSoon: !!res,
        },
        org.kitchenLateMinutes,
        now,
      );
      return {
        id: t.id, name: t.name, areaId: t.areaId, shape: t.shape, seats: t.seats, x: t.x, y: t.y, w: t.w, h: t.h, rotation: t.rotation, state,
        order: o
          ? {
              id: o.id, number: o.number, guests: o.guests, total: o.total, openedAt: o.openedAt.toISOString(), waiterId: o.waiterId,
              waiterName: o.waiter?.name ?? null, waiterColor: o.waiter?.color ?? null, readyItems: ready, draftItems: draft, heldItems: held,
            }
          : null,
        reservation: res ? { name: res.name, partySize: res.partySize, dateTime: res.dateTime.toISOString() } : null,
      };
    }),
  };
}
