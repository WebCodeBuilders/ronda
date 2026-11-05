import { z } from "zod";
import { body, fail, requireUser, route } from "@/lib/api";
import {
  addItems, addPayment, cancelOrder, fireCourse, mergeOrders, printBill, reopenOrder, sendOrder, setDiscount, setFulfillment, transferTable, updateOrder,
} from "@/lib/orders/service";
import { serveReady } from "@/lib/orders/kitchen";

/**
 * Todas las acciones sobre un pedido entran por acá, cada una con su esquema y
 * su permiso. La lógica vive en lib/orders/service.ts.
 */
const item = z.object({
  productId: z.string(),
  quantity: z.number().positive().max(999),
  modifierIds: z.array(z.string()).optional(),
  notes: z.string().max(200).optional().nullable(),
  course: z.number().int().min(0).max(9).optional(),
  seat: z.number().int().min(1).max(99).optional().nullable(),
  price: z.number().min(0).optional(),
});

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("addItems"), items: z.array(item).min(1).max(100) }),
  z.object({ action: z.literal("send"), holdLater: z.boolean().optional() }),
  z.object({ action: z.literal("fireCourse"), course: z.number().int().optional() }),
  z.object({ action: z.literal("serveReady") }),
  z.object({
    action: z.literal("update"),
    guests: z.number().int().min(1).max(200).optional(),
    customerId: z.string().nullable().optional(),
    notes: z.string().max(300).nullable().optional(),
    waiterId: z.string().nullable().optional(),
    customerName: z.string().max(80).nullable().optional(),
    customerPhone: z.string().max(40).nullable().optional(),
    deliveryAddress: z.string().max(200).nullable().optional(),
    deliveryFee: z.number().min(0).optional(),
  }),
  z.object({ action: z.literal("discount"), pct: z.number().min(0).max(100), amount: z.number().min(0), reason: z.string().max(120).nullable().optional(), managerPin: z.string().optional() }),
  z.object({ action: z.literal("transfer"), tableId: z.string() }),
  z.object({ action: z.literal("merge"), sourceOrderId: z.string() }),
  z.object({ action: z.literal("bill") }),
  z.object({
    action: z.literal("pay"),
    methodId: z.string(),
    amount: z.number().positive(),
    tip: z.number().min(0).optional(),
    tendered: z.number().min(0).optional(),
    customerId: z.string().nullable().optional(),
    reference: z.string().max(80).nullable().optional(),
    items: z.array(z.object({ itemId: z.string(), quantity: z.number().positive() })).optional(),
  }),
  z.object({ action: z.literal("cancel"), reason: z.string().min(1).max(200), managerPin: z.string().optional() }),
  z.object({ action: z.literal("reopen"), reason: z.string().min(1).max(200) }),
  z.object({ action: z.literal("fulfillment"), step: z.enum(["PENDING", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED"]), courierId: z.string().nullable().optional() }),
]);

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const { id } = await params;
  const input = await body(req, schema);
  const ctx = { orgId: user.organizationId, user };
  const need = (p: Parameters<typeof user.permissions.has>[0]) => {
    if (!user.permissions.has(p)) fail(403, "No tenés permiso para esto.");
  };
  switch (input.action) {
    case "addItems":
      need("orders.edit");
      await addItems(ctx, id, input.items);
      return { ok: true };
    case "send":
      need("orders.send");
      return sendOrder(ctx, id, { holdLater: input.holdLater });
    case "fireCourse":
      need("orders.send");
      return fireCourse(ctx, id, input.course);
    case "serveReady":
      need("salon.view");
      await serveReady(user.organizationId, id);
      return { ok: true };
    case "update": {
      need("orders.edit");
      const { action: _a, ...patch } = input;
      void _a;
      await updateOrder(ctx, id, patch);
      return { ok: true };
    }
    case "discount":
      await setDiscount(ctx, id, input);
      return { ok: true };
    case "transfer":
      need("orders.transfer");
      await transferTable(ctx, id, input.tableId);
      return { ok: true };
    case "merge":
      need("orders.transfer");
      await mergeOrders(ctx, id, input.sourceOrderId);
      return { ok: true };
    case "bill":
      need("salon.view");
      return printBill(ctx, id);
    case "pay": {
      const { action: _a, ...pay } = input;
      void _a;
      return addPayment(ctx, id, pay);
    }
    case "cancel":
      await cancelOrder(ctx, id, input);
      return { ok: true };
    case "reopen":
      await reopenOrder(ctx, id, input.reason);
      return { ok: true };
    case "fulfillment":
      need("delivery.manage");
      await setFulfillment(ctx, id, input.step, input.courierId);
      return { ok: true };
  }
});
