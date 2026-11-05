import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";
import { publish } from "@/lib/realtime/bus";

const schema = z.object({
  kind: z.enum(["RESERVATION", "WAITLIST"]).default("RESERVATION"),
  customerId: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).nullable().optional(),
  partySize: z.number().int().min(1).max(200),
  dateTime: z.string().datetime().optional(),
  durationMin: z.number().int().min(15).max(600).default(90),
  tableId: z.string().nullable().optional(),
  areaPreference: z.string().max(40).nullable().optional(),
  quotedMinutes: z.number().int().min(0).max(300).nullable().optional(),
  notes: z.string().max(300).nullable().optional(),
});

export const POST = route(async (req: Request) => {
  const user = await requireUser("reservations.manage");
  const d = await body(req, schema);
  if (d.kind === "RESERVATION" && !d.dateTime) fail(400, "Falta el día y la hora.");
  if (d.tableId) {
    const t = await prisma.diningTable.findFirst({ where: { id: d.tableId, organizationId: user.organizationId } });
    if (!t) fail(404, "La mesa no existe.");
  }
  const r = await prisma.reservation.create({
    data: {
      ...d,
      organizationId: user.organizationId,
      dateTime: d.dateTime ? new Date(d.dateTime) : new Date(),
      status: d.kind === "WAITLIST" ? "PENDING" : "CONFIRMED",
    },
  });
  await publish(user.organizationId, { type: "reservations.changed" });
  return { id: r.id };
});
