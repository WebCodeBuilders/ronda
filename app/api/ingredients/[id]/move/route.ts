import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";

const schema = z.object({ kind: z.enum(["PURCHASE", "WASTE", "ADJUST"]), quantity: z.number(), note: z.string().max(120).nullable().optional(), unitCost: z.number().min(0).optional() });

/** Compra (suma), merma (resta) o conteo físico (fija el stock en lo contado). */
export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("stock.manage");
  const { id } = await params;
  const d = await body(req, schema);
  await prisma.$transaction(async (tx) => {
    const i = await tx.ingredient.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!i) fail(404, "El insumo no existe.");
    const delta = d.kind === "ADJUST" ? d.quantity - i.stock : d.kind === "WASTE" ? -Math.abs(d.quantity) : Math.abs(d.quantity);
    // Costo promedio ponderado al comprar.
    const cost = d.kind === "PURCHASE" && d.unitCost !== undefined && i.stock + delta > 0 ? (Math.max(0, i.stock) * i.cost + delta * d.unitCost) / (Math.max(0, i.stock) + delta) : i.cost;
    await tx.ingredient.update({ where: { id }, data: { stock: { increment: delta }, cost } });
    await tx.stockMovement.create({ data: { organizationId: user.organizationId, ingredientId: id, kind: d.kind, quantity: delta, note: d.note ?? null, userId: user.id } });
  });
});
