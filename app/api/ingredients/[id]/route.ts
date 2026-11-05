import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { ingredientSchema } from "../schema";

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("stock.manage");
  const { id } = await params;
  const { stock: _s, ...d } = await body(req, ingredientSchema);
  void _s;
  const r = await prisma.ingredient.updateMany({ where: { id, organizationId: user.organizationId }, data: d });
  if (!r.count) fail(404, "El insumo no existe.");
});

export const DELETE = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("stock.manage");
  const { id } = await params;
  await prisma.ingredient.updateMany({ where: { id, organizationId: user.organizationId }, data: { active: false } });
});
