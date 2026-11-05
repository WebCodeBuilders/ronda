import { prisma } from "@/lib/prisma";
import { fail, requireUser, route } from "@/lib/api";
import { renderEscPos, sendToPrinter } from "@/lib/printing/escpos";
import { testPage } from "@/lib/printing/test";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("settings.manage");
  const { id } = await params;
  const s = await prisma.station.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!s) fail(404, "La estación no existe.");
  if (!s.printerHost) fail(400, "Cargá la IP de la impresora y guardá primero.");
  try {
    await sendToPrinter(s.printerHost, s.printerPort, renderEscPos(testPage(s.name, s.printerWidth)));
  } catch (e) {
    fail(502, (e as Error).message);
  }
});
