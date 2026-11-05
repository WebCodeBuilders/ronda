import { prisma } from "@/lib/prisma";
import { fail, requireUser, route } from "@/lib/api";
import { renderEscPos, sendToPrinter } from "@/lib/printing/escpos";
import { testPage } from "@/lib/printing/test";

export const POST = route(async () => {
  const user = await requireUser("settings.manage");
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  if (!org.receiptPrinterHost) {
    const job = await prisma.printJob.create({ data: { organizationId: org.id, kind: "RECIBO", title: "Prueba", content: testPage("Caja", org.receiptPrinterWidth) } });
    return { browserPrint: true, jobId: job.id };
  }
  try {
    await sendToPrinter(org.receiptPrinterHost, org.receiptPrinterPort, renderEscPos(testPage("Caja", org.receiptPrinterWidth)));
  } catch (e) {
    fail(502, (e as Error).message);
  }
  return { ok: true };
});
