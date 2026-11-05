import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";
import { publish } from "@/lib/realtime/bus";
import { roundPrice } from "@/lib/menu";

const schema = z.object({ pct: z.number().min(-90).max(500), categoryIds: z.array(z.string()).default([]), roundTo: z.number().min(0).max(10000).default(100), dryRun: z.boolean().default(false) });

/** Aumento (o rebaja) de precios en bloque, con redondeo comercial. */
export const POST = route(async (req: Request) => {
  const user = await requireUser("menu.manage");
  const d = await body(req, schema);
  const products = await prisma.product.findMany({
    where: { organizationId: user.organizationId, active: true, openPrice: false, ...(d.categoryIds.length ? { categoryId: { in: d.categoryIds } } : {}) },
    select: { id: true, name: true, price: true },
  });
  const changes = products.map((p) => ({ id: p.id, name: p.name, from: p.price, to: roundPrice(p.price * (1 + d.pct / 100), d.roundTo) })).filter((c) => c.to !== c.from);
  if (d.dryRun) return { changes };
  await prisma.$transaction(async (tx) => {
    for (const c of changes) await tx.product.update({ where: { id: c.id }, data: { price: c.to } });
    await audit(tx, user.organizationId, user.id, "product.bulk_price", `Actualizó ${changes.length} precios un ${d.pct} %`, { amount: d.pct });
  });
  await publish(user.organizationId, { type: "menu.changed" });
  return { changes, applied: true };
});
