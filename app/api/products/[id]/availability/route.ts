import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUserOrDevice, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({ available: z.boolean() });

/** "86": se terminó un plato. Se apaga al instante en todas las terminales y en la carta QR. */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { organizationId, user } = await requireUserOrDevice("menu.availability", ["KDS"]);
  const { id } = await params;
  const { available } = await body(req, schema);
  const p = await prisma.product.findFirst({ where: { id, organizationId } });
  if (!p) fail(404, "El producto no existe.");
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { available } });
    await audit(tx, organizationId, user?.id ?? null, "product.availability", `${available ? "Volvió a haber" : "Sin stock"}: ${p.name}`, { entity: "product", entityId: id });
  });
  await publish(organizationId, { type: "menu.changed" });
});
