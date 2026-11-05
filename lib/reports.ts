import "server-only";
import { prisma } from "@/lib/prisma";
import { APP_TIME_ZONE, round2 } from "@/lib/utils";

/**
 * Las cuentas de los reportes, en un solo lugar: el Inicio y Reportes leen
 * de acá, así el número de "ventas de hoy" es el mismo en las dos pantallas.
 *
 * Una venta cuenta el día que se COBRÓ (closedAt), no el que se abrió.
 */

export type Range = { from: Date; to: Date };

/** Hora local (0-23) de una fecha, en la zona del comercio. */
function localHour(d: Date): number {
  return Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: APP_TIME_ZONE }).format(d)) % 24;
}

function localDay(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIME_ZONE }).format(d); // AAAA-MM-DD
}

/** Inicio del día de hoy en la zona del comercio (00:00 de Buenos Aires). */
export function startOfToday(now = new Date()): Date {
  const day = localDay(now);
  // Buenos Aires es UTC-3 todo el año.
  return new Date(`${day}T00:00:00-03:00`);
}

export function rangeFromParams(from?: string | null, to?: string | null, defDays = 7): Range {
  const today = startOfToday();
  const f = from ? new Date(`${from}T00:00:00-03:00`) : new Date(today.getTime() - (defDays - 1) * 86_400_000);
  const t = to ? new Date(new Date(`${to}T00:00:00-03:00`).getTime() + 86_400_000) : new Date(today.getTime() + 86_400_000);
  return { from: f, to: t };
}

export async function salesReport(orgId: string, range: Range) {
  const orders = await prisma.order.findMany({
    where: { organizationId: orgId, status: "PAID", closedAt: { gte: range.from, lt: range.to } },
    select: {
      id: true, type: true, total: true, subtotal: true, tip: true, guests: true, openedAt: true, closedAt: true, discountPct: true, discountAmount: true, serviceCharge: true,
      waiter: { select: { id: true, name: true } },
      items: { where: { status: { not: "VOID" } }, select: { name: true, quantity: true, total: true, productId: true, product: { select: { cost: true, category: { select: { name: true } } } } } },
    },
  });
  const [payments, voids, tickets, cancelled] = await Promise.all([
    prisma.payment.findMany({
      where: { order: { organizationId: orgId }, createdAt: { gte: range.from, lt: range.to } },
      select: { amount: true, tip: true, surcharge: true, method: { select: { name: true } } },
    }),
    prisma.orderItem.findMany({
      where: { order: { organizationId: orgId }, status: "VOID", voidedAt: { gte: range.from, lt: range.to } },
      select: { name: true, quantity: true, total: true, voidReason: true, voidedAt: true, order: { select: { id: true, number: true } } },
      orderBy: { voidedAt: "desc" },
      take: 50,
    }),
    prisma.kitchenTicket.findMany({
      where: { organizationId: orgId, createdAt: { gte: range.from, lt: range.to }, readyAt: { not: null } },
      select: { createdAt: true, readyAt: true, station: { select: { name: true } } },
    }),
    prisma.order.count({ where: { organizationId: orgId, status: "CANCELLED", closedAt: { gte: range.from, lt: range.to } } }),
  ]);

  const total = round2(orders.reduce((s, o) => s + o.total, 0));
  const tips = round2(orders.reduce((s, o) => s + o.tip, 0));
  const guests = orders.filter((o) => o.type === "DINE_IN" || o.type === "QR").reduce((s, o) => s + o.guests, 0);
  const discounts = round2(orders.reduce((s, o) => s + o.subtotal * (o.discountPct / 100) + o.discountAmount, 0));
  const cost = round2(orders.reduce((s, o) => s + o.items.reduce((a, i) => a + (i.product?.cost ?? 0) * i.quantity, 0), 0));

  const byHour = Array.from({ length: 24 }, (_, h) => ({ hour: h, total: 0, orders: 0 }));
  const byDay = new Map<string, { day: string; total: number; orders: number }>();
  const byType = new Map<string, { type: string; total: number; orders: number }>();
  const byWaiter = new Map<string, { name: string; total: number; orders: number; tips: number; guests: number }>();
  const byProduct = new Map<string, { name: string; quantity: number; total: number; category: string }>();
  const byCategory = new Map<string, { name: string; total: number; quantity: number }>();
  let durationSum = 0;
  let durationN = 0;

  for (const o of orders) {
    const closed = o.closedAt!;
    const h = byHour[localHour(closed)]!;
    h.total += o.total;
    h.orders++;
    const dk = localDay(closed);
    const d = byDay.get(dk) ?? { day: dk, total: 0, orders: 0 };
    d.total += o.total;
    d.orders++;
    byDay.set(dk, d);
    const t = byType.get(o.type) ?? { type: o.type, total: 0, orders: 0 };
    t.total += o.total;
    t.orders++;
    byType.set(o.type, t);
    if (o.waiter) {
      const w = byWaiter.get(o.waiter.id) ?? { name: o.waiter.name, total: 0, orders: 0, tips: 0, guests: 0 };
      w.total += o.total;
      w.orders++;
      w.tips += o.tip;
      w.guests += o.type === "DINE_IN" ? o.guests : 0;
      byWaiter.set(o.waiter.id, w);
    }
    for (const i of o.items) {
      const cat = i.product?.category?.name ?? "Sin categoría";
      const key = i.productId ?? i.name;
      const p = byProduct.get(key) ?? { name: i.name, quantity: 0, total: 0, category: cat };
      p.quantity += i.quantity;
      p.total += i.total;
      byProduct.set(key, p);
      const c = byCategory.get(cat) ?? { name: cat, total: 0, quantity: 0 };
      c.total += i.total;
      c.quantity += i.quantity;
      byCategory.set(cat, c);
    }
    if (o.type === "DINE_IN") {
      durationSum += closed.getTime() - o.openedAt.getTime();
      durationN++;
    }
  }

  const byMethod = new Map<string, { name: string; total: number; count: number }>();
  for (const p of payments) {
    const m = byMethod.get(p.method.name) ?? { name: p.method.name, total: 0, count: 0 };
    m.total += p.amount + p.surcharge;
    m.count += p.amount > 0 ? 1 : 0;
    byMethod.set(p.method.name, m);
  }

  const byStation = new Map<string, { name: string; avgMin: number; n: number; sum: number; late: number }>();
  for (const t of tickets) {
    const s = byStation.get(t.station.name) ?? { name: t.station.name, avgMin: 0, n: 0, sum: 0, late: 0 };
    const min = (t.readyAt!.getTime() - t.createdAt.getTime()) / 60000;
    s.n++;
    s.sum += min;
    if (min > 15) s.late++;
    byStation.set(t.station.name, s);
  }

  const r = (n: number) => round2(n);
  return {
    totals: {
      total,
      orders: orders.length,
      avgTicket: orders.length ? r(total / orders.length) : 0,
      guests,
      perGuest: guests ? r(orders.filter((o) => o.type === "DINE_IN").reduce((s, o) => s + o.total, 0) / guests) : 0,
      tips,
      discounts,
      cost,
      grossMarginPct: total > 0 ? r(((total - cost) / total) * 100) : 0,
      avgTableMinutes: durationN ? Math.round(durationSum / durationN / 60000) : 0,
      voids: voids.length,
      voidsAmount: r(voids.reduce((s, v) => s + v.total, 0)),
      cancelled,
    },
    byHour: byHour.map((h) => ({ ...h, total: r(h.total) })),
    byDay: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).map((d) => ({ ...d, total: r(d.total) })),
    byType: [...byType.values()].map((t) => ({ ...t, total: r(t.total) })).sort((a, b) => b.total - a.total),
    byWaiter: [...byWaiter.values()].map((w) => ({ ...w, total: r(w.total), tips: r(w.tips), avg: w.orders ? r(w.total / w.orders) : 0 })).sort((a, b) => b.total - a.total),
    byProduct: [...byProduct.values()].map((p) => ({ ...p, total: r(p.total) })).sort((a, b) => b.quantity - a.quantity),
    byCategory: [...byCategory.values()].map((c) => ({ ...c, total: r(c.total) })).sort((a, b) => b.total - a.total),
    byMethod: [...byMethod.values()].map((m) => ({ ...m, total: r(m.total) })).sort((a, b) => b.total - a.total),
    byStation: [...byStation.values()].map((s) => ({ name: s.name, avgMin: s.n ? Math.round((s.sum / s.n) * 10) / 10 : 0, tickets: s.n, latePct: s.n ? Math.round((s.late / s.n) * 100) : 0 })),
    voids: voids.map((v) => ({ name: v.name, quantity: v.quantity, total: v.total, reason: v.voidReason, at: v.voidedAt!.toISOString(), orderId: v.order.id, orderNumber: v.order.number })),
  };
}

export type SalesReport = Awaited<ReturnType<typeof salesReport>>;
