import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";
import { cashSummary } from "@/lib/cash";
import { publish } from "@/lib/realtime/bus";
import { dispatchPrintJobs } from "@/lib/printing/queue";
import { formatCurrency, formatDate } from "@/lib/utils";

const schema = z.object({ countedCash: z.number().min(0), notes: z.string().max(300).optional().nullable() });

/** Cierre de caja (cierre Z): cuenta el efectivo, guarda la diferencia e imprime el resumen. */
export const POST = route(async (req: Request) => {
  const user = await requireUser("cash.manage");
  const { countedCash, notes } = await body(req, schema);
  const s = await prisma.cashSession.findFirst({ where: { organizationId: user.organizationId, closedAt: null } });
  if (!s) fail(409, "No hay caja abierta.");
  const sum = await cashSummary(s.id);
  const difference = Math.round((countedCash - sum.totals.expectedCash) * 100) / 100;
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  const w = org.receiptPrinterWidth;
  const row = (l: string, r: string) => l + " ".repeat(Math.max(1, w - l.length - r.length)) + r;
  const content = [
    `@@LC ${org.name}`,
    "@@BC CIERRE DE CAJA",
    `Apertura: ${formatDate(s.openedAt)} (${sum.session.openedBy})`,
    `Cierre:   ${formatDate(new Date())} (${user.name})`,
    "-".repeat(w),
    ...sum.methods.map((m) => row(`${m.name} (${m.count})`, formatCurrency(m.amount + m.surcharge))),
    "-".repeat(w),
    row("Ventas", formatCurrency(sum.totals.sales)),
    row("Propinas", formatCurrency(sum.totals.tips)),
    row("Recargos", formatCurrency(sum.totals.surcharges)),
    "-".repeat(w),
    row("Fondo inicial", formatCurrency(s.openingAmount)),
    row("Efectivo cobrado", formatCurrency(sum.totals.cashPayments)),
    row("Ingresos", formatCurrency(sum.totals.ins)),
    row("Retiros", `-${formatCurrency(sum.totals.outs)}`),
    `@@B ${row("Efectivo esperado", formatCurrency(sum.totals.expectedCash))}`,
    `@@B ${row("Efectivo contado", formatCurrency(countedCash))}`,
    `@@B ${row("Diferencia", formatCurrency(difference))}`,
    notes ? `Nota: ${notes}` : "",
    "@@CUT",
  ].join("\n");
  const job = await prisma.$transaction(async (tx) => {
    await tx.cashSession.update({ where: { id: s.id }, data: { closedAt: new Date(), closedById: user.id, expectedCash: sum.totals.expectedCash, countedCash, difference, notes: notes ?? null } });
    await audit(tx, user.organizationId, user.id, "cash.close", `Cerró la caja. Esperado ${sum.totals.expectedCash.toFixed(2)}, contado ${countedCash.toFixed(2)}, diferencia ${difference.toFixed(2)}`, { amount: difference });
    return tx.printJob.create({ data: { organizationId: user.organizationId, kind: "CIERRE_CAJA", title: "Cierre de caja", content, host: org.receiptPrinterHost, port: org.receiptPrinterPort } });
  });
  if (job.host) dispatchPrintJobs([job.id]);
  await publish(user.organizationId, { type: "cash.changed" });
  return { ok: true, difference, jobId: job.id, browserPrint: !job.host, sessionId: s.id };
});
