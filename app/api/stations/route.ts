import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";
import { stationSchema } from "./schema";

export const POST = route(async (req: Request) => {
  const user = await requireUser("settings.manage");
  const d = await body(req, stationSchema);
  const count = await prisma.station.count({ where: { organizationId: user.organizationId } });
  const s = await prisma.station.create({ data: { ...d, organizationId: user.organizationId, sort: count } });
  await publish(user.organizationId, { type: "kitchen.changed" });
  return { id: s.id };
});
