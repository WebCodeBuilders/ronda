import { z } from "zod";
import { body, requireUserOrDevice, route } from "@/lib/api";
import { ticketAction } from "@/lib/orders/kitchen";

const schema = z.object({ action: z.enum(["start", "ready", "done", "recall", "priority", "reprint"]) });

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { organizationId } = await requireUserOrDevice("kitchen.view", ["KDS"]);
  const { id } = await params;
  const { action } = await body(req, schema);
  await ticketAction(organizationId, id, action);
});
