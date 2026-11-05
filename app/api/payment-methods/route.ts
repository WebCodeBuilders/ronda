
import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";

import { methodSchema } from "./schema";

export const POST = route(async (req: Request) => {
  const user = await requireUser("settings.manage");
  const d = await body(req, methodSchema);
  const count = await prisma.paymentMethod.count({ where: { organizationId: user.organizationId } });
  const m = await prisma.paymentMethod.create({ data: { ...d, organizationId: user.organizationId, sort: count } });
  return { id: m.id };
});
