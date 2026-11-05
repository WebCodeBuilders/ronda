import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({ status: z.enum(["ACK", "DONE"]) });

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("salon.view");
  const { id } = await params;
  const { status } = await body(req, schema);
  const r = await prisma.serviceRequest.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!r) fail(404, "El llamado no existe.");
  await prisma.serviceRequest.update({
    where: { id },
    data: { status, ackById: status === "ACK" ? user.id : undefined, resolvedAt: status === "DONE" ? new Date() : undefined },
  });
  await publish(user.organizationId, { type: "request.changed" });
  await publish(user.organizationId, { type: "tables.changed" });
});
