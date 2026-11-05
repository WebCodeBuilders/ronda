import "server-only";
import { prisma } from "@/lib/prisma";
import { publish } from "@/lib/realtime/bus";
import { renderEscPos, sendToPrinter } from "./escpos";

/**
 * Cola de impresión con reintentos.
 *
 * El problema clásico de las comanderas: la impresora estaba apagada, sin
 * papel o se cayó el wifi, y la comanda "se perdió". Acá nunca se pierde:
 *  1. se guarda el trabajo (PENDING) en la misma operación que crea la comanda,
 *  2. se intenta imprimir enseguida,
 *  3. si falla queda FAILED, la caja recibe un aviso en vivo y se reintenta
 *     solo cada 20 s (hasta 30 veces); también se puede reimprimir a mano,
 *  4. si la estación además tiene pantalla (KDS), la cocina ya la está viendo.
 */

const MAX_ATTEMPTS = 30;

export async function processPrintJob(jobId: string): Promise<boolean> {
  const job = await prisma.printJob.findUnique({ where: { id: jobId }, include: { station: true } });
  if (!job || job.status === "PRINTED") return true;
  if (!job.host) {
    // Sin impresora de red: queda para imprimir desde el navegador de la caja.
    return false;
  }
  try {
    const copies = job.kind === "COMANDA" ? job.station?.printerCopies ?? 1 : 1;
    await sendToPrinter(job.host, job.port ?? 9100, renderEscPos(job.content, copies));
    await prisma.printJob.update({ where: { id: job.id }, data: { status: "PRINTED", printedAt: new Date(), attempts: { increment: 1 }, lastError: null } });
    return true;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const updated = await prisma.printJob.update({
      where: { id: job.id },
      data: { status: "FAILED", attempts: { increment: 1 }, lastError: msg },
    });
    // Solo se avisa la primera vez: no inundar la caja con el mismo error.
    if (updated.attempts === 1) {
      await publish(job.organizationId, { type: "print.failed", jobId: job.id, title: job.title, error: msg });
    }
    return false;
  }
}

/** Encola y dispara sin bloquear la respuesta de quien marchó el pedido. */
export function dispatchPrintJobs(jobIds: string[]) {
  for (const id of jobIds) {
    processPrintJob(id).catch((e) => console.error("[print]", e));
  }
}

export async function retryFailedJobs() {
  const jobs = await prisma.printJob.findMany({
    where: { status: { in: ["FAILED", "PENDING"] }, host: { not: null }, attempts: { lt: MAX_ATTEMPTS }, createdAt: { gt: new Date(Date.now() - 6 * 3600_000) } },
    select: { id: true },
    take: 20,
    orderBy: { createdAt: "asc" },
  });
  for (const j of jobs) await processPrintJob(j.id);
}

const g = globalThis as unknown as { __rondaPrintLoop?: ReturnType<typeof setInterval> };

export function startPrintRetryLoop() {
  if (g.__rondaPrintLoop) return;
  g.__rondaPrintLoop = setInterval(() => {
    retryFailedJobs().catch((e) => console.error("[print-retry]", e));
  }, 20_000);
}
