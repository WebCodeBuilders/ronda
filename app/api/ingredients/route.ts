import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";
import { ingredientSchema } from "./schema";

export const POST = route(async (req: Request) => {
  const user = await requireUser("stock.manage");
  const d = await body(req, ingredientSchema);
  const i = await prisma.ingredient.create({ data: { organizationId: user.organizationId, name: d.name, unit: d.unit, minStock: d.minStock, cost: d.cost, stock: d.stock ?? 0 } });
  return { id: i.id };
});
