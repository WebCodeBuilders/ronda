import { prisma } from "@/lib/prisma";
import { requireUser, route } from "@/lib/api";

/** Marca como impreso lo que salió por el navegador. */
export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  await prisma.printJob.updateMany({ where: { id, organizationId: user.organizationId, host: null }, data: { status: "PRINTED", printedAt: new Date(), attempts: { increment: 1 } } });
});
