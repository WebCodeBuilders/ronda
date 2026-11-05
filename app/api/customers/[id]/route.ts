import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, fail, requireUser, route } from "@/lib/api";

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).nullable().optional(),
  email: z.string().trim().max(120).nullable().optional(),
  address: z.string().trim().max(200).nullable().optional(),
  addressNotes: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  birthday: z.string().nullable().optional(),
  creditLimit: z.number().min(0).optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const PUT = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const user = await requireUser("customers.manage");
  const { id } = await params;
  const d = await body(req, schema);
  const r = await prisma.customer.updateMany({
    where: { id, organizationId: user.organizationId },
    data: { ...d, phone: d.phone || null, email: d.email || null, address: d.address || null, addressNotes: d.addressNotes || null, notes: d.notes || null, birthday: d.birthday ? new Date(d.birthday) : null },
  });
  if (!r.count) fail(404, "El cliente no existe.");
});
