import { prisma } from "@/lib/prisma";
import { fail, requireUser, route } from "@/lib/api";
import { processPrintJob } from "@/lib/printing/queue";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const job = await prisma.printJob.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!job) fail(404, "El impreso no existe.");
  if (!job.host) return { ok: true, browser: true };
  const ok = await processPrintJob(job.id);
  if (!ok) {
    const j = await prisma.printJob.findUniqueOrThrow({ where: { id } });
    fail(502, j.lastError ?? "La impresora no respondió.");
  }
  return { ok: true };
});
