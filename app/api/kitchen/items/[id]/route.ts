import { requireUserOrDevice, route } from "@/lib/api";
import { toggleItemReady } from "@/lib/orders/kitchen";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { organizationId } = await requireUserOrDevice("kitchen.view", ["KDS"]);
  const { id } = await params;
  await toggleItemReady(organizationId, id);
});
