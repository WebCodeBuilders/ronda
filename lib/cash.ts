import "server-only";
import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/utils";

/**
 * Resumen de un turno de caja. La plata en efectivo se SUMA de lo que entró
 * (cobros en efectivo, con su propina y recargo) y se resta lo que salió
 * (retiros, devoluciones): nunca se deduce mirando estados de pedidos.
 */
export async function cashSummary(sessionId: string) {
  const s = await prisma.cashSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      openedBy: { select: { name: true } },
      closedBy: { select: { name: true } },
      movements: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      payments: { include: { method: { select: { name: true, kind: true } }, order: { select: { id: true, number: true, type: true, table: { select: { name: true } } } }, createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  const byMethod = new Map<string, { name: string; kind: string; amount: number; tips: number; surcharge: number; count: number }>();
  for (const p of s.payments) {
    const cur = byMethod.get(p.methodId) ?? { name: p.method.name, kind: p.method.kind, amount: 0, tips: 0, surcharge: 0, count: 0 };
    cur.amount = round2(cur.amount + p.amount);
    cur.tips = round2(cur.tips + p.tip);
    cur.surcharge = round2(cur.surcharge + p.surcharge);
    cur.count += p.amount > 0 ? 1 : 0;
    byMethod.set(p.methodId, cur);
  }
  const cashPayments = s.payments.filter((p) => p.method.kind === "CASH").reduce((acc, p) => acc + p.amount + p.tip + p.surcharge, 0);
  const ins = s.movements.filter((m) => m.kind === "IN").reduce((acc, m) => acc + m.amount, 0);
  const outs = s.movements.filter((m) => m.kind === "OUT").reduce((acc, m) => acc + m.amount, 0);
  const expectedCash = round2(s.openingAmount + cashPayments + ins - outs);
  const sales = round2(s.payments.reduce((acc, p) => acc + p.amount, 0));
  const tips = round2(s.payments.reduce((acc, p) => acc + p.tip, 0));
  const surcharges = round2(s.payments.reduce((acc, p) => acc + p.surcharge, 0));
  const tipsByWaiter = new Map<string, number>();
  return {
    session: {
      id: s.id,
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      openedBy: s.openedBy.name,
      closedBy: s.closedBy?.name ?? null,
      openingAmount: s.openingAmount,
      countedCash: s.countedCash,
      difference: s.difference,
      notes: s.notes,
    },
    methods: [...byMethod.values()].sort((a, b) => b.amount - a.amount),
    movements: s.movements.map((m) => ({ id: m.id, kind: m.kind, amount: m.amount, reason: m.reason, user: m.user?.name ?? null, createdAt: m.createdAt.toISOString() })),
    payments: s.payments.slice(0, 200).map((p) => ({
      id: p.id,
      method: p.method.name,
      amount: p.amount,
      tip: p.tip,
      surcharge: p.surcharge,
      orderId: p.order?.id ?? null,
      orderLabel: p.order ? (p.order.table ? `Mesa ${p.order.table.name}` : `#${p.order.number}`) : "Pago a cuenta",
      by: p.createdBy?.name ?? null,
      createdAt: p.createdAt.toISOString(),
      reference: p.reference,
    })),
    totals: { sales, tips, surcharges, cashPayments: round2(cashPayments), ins: round2(ins), outs: round2(outs), expectedCash, count: s.payments.filter((p) => p.amount > 0).length },
    tipsByWaiter: [...tipsByWaiter.entries()],
  };
}

export type CashSummary = Awaited<ReturnType<typeof cashSummary>>;
