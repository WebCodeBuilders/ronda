import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";

export const dynamic = "force-dynamic";

const pick = { id: true, name: true, phone: true, email: true, address: true, addressNotes: true, notes: true, balance: true, creditLimit: true, points: true, tags: true } as const;

/** Búsqueda rápida (para el pedido, el delivery y las reservas). */
export const GET = route(async (req: Request) => {
  const user = await requireUser();
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  const digits = q.replace(/\D/g, "");
  const customers = await prisma.customer.findMany({
    where: {
      organizationId: user.organizationId,
      ...(q
        ? { OR: [{ name: { contains: q, mode: "insensitive" } }, ...(digits.length >= 3 ? [{ phone: { contains: digits.slice(-8) } }] : []), { phone: { contains: q } }] }
        : {}),
    },
    select: pick,
    orderBy: { updatedAt: "desc" },
    take: 10,
  });
  return { customers };
});

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(120).optional().nullable().or(z.literal("")),
  address: z.string().trim().max(200).optional().nullable(),
  addressNotes: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
  birthday: z.string().optional().nullable(),
  creditLimit: z.number().min(0).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const POST = route(async (req: Request) => {
  const user = await requireUser();
  if (!user.permissions.has("customers.manage") && !user.permissions.has("orders.create") && !user.permissions.has("reservations.manage")) {
    return Response.json({ error: "No tenés permiso para esto." }, { status: 403 });
  }
  const d = await body(req, schema);
  const customer = await prisma.customer.create({
    data: {
      organizationId: user.organizationId,
      name: d.name,
      phone: d.phone || null,
      email: d.email || null,
      address: d.address || null,
      addressNotes: d.addressNotes || null,
      notes: d.notes || null,
      birthday: d.birthday ? new Date(d.birthday) : null,
      creditLimit: user.permissions.has("customers.manage") ? d.creditLimit ?? 0 : 0,
      tags: d.tags ?? [],
    },
    select: pick,
  });
  return { customer };
});
