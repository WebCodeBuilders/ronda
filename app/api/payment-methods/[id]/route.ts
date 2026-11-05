import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { methodSchema } from "../schema";

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("settings.manage");
  const { id } = await params;
  const r = await prisma.paymentMethod.updateMany({ where: { id, organizationId: user.organizationId }, data: await body(req, methodSchema) });
  if (!r.count) fail(404, "El medio de pago no existe.");
});
