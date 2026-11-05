import { z } from "zod";
import { body, requireUser, route } from "@/lib/api";
import { createOrder } from "@/lib/orders/service";

const schema = z.object({
  type: z.enum(["DINE_IN", "COUNTER", "TAKEAWAY", "DELIVERY"]),
  tableId: z.string().optional().nullable(),
  guests: z.number().int().min(1).max(200).optional(),
  customerId: z.string().optional().nullable(),
  customerName: z.string().trim().max(80).optional().nullable(),
  customerPhone: z.string().trim().max(40).optional().nullable(),
  deliveryAddress: z.string().trim().max(200).optional().nullable(),
  deliveryFee: z.number().min(0).optional(),
  notes: z.string().trim().max(300).optional().nullable(),
  scheduledFor: z.string().datetime().optional().nullable(),
});

export const POST = route(async (req: Request) => {
  const user = await requireUser("orders.create");
  const input = await body(req, schema);
  const { order, created } = await createOrder(
    { orgId: user.organizationId, user },
    { ...input, scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null },
  );
  return { id: order.id, created };
});
