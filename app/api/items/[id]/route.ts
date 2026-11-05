import { z } from "zod";
import { body, requireUser, route } from "@/lib/api";
import { updateDraftItem, voidItem } from "@/lib/orders/service";

const patchSchema = z.object({
  quantity: z.number().positive().max(999).optional(),
  notes: z.string().max(200).nullable().optional(),
  course: z.number().int().min(0).max(9).optional(),
  seat: z.number().int().min(1).max(99).nullable().optional(),
});

export const PATCH = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("orders.edit");
  const { id } = await params;
  await updateDraftItem({ orgId: user.organizationId, user }, id, await body(req, patchSchema));
});

const voidSchema = z.object({ reason: z.string().max(200).optional(), managerPin: z.string().optional() });

/** Anular: lo no marchado se borra; lo marchado queda anulado con motivo. */
export const DELETE = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("orders.edit");
  const { id } = await params;
  const input = req.headers.get("content-type")?.includes("json") ? await body(req, voidSchema) : {};
  await voidItem({ orgId: user.organizationId, user }, id, input);
});
