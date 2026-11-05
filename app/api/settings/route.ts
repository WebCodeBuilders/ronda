import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { body, requireUser, route } from "@/lib/api";
import { audit } from "@/lib/db-helpers";

const schema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  kind: z.string().max(30).optional(),
  address: z.string().trim().max(160).nullable().optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  taxId: z.string().trim().max(20).nullable().optional(),
  serviceChargePerGuest: z.number().min(0).optional(),
  suggestedTipPct: z.number().min(0).max(50).optional(),
  kitchenLateMinutes: z.number().int().min(1).max(180).optional(),
  voidNeedsManager: z.boolean().optional(),
  qrOrderingEnabled: z.boolean().optional(),
  qrOrderNeedsApproval: z.boolean().optional(),
  pesosPerPoint: z.number().min(0).optional(),
  ticketFooter: z.string().max(160).nullable().optional(),
  receiptPrinterHost: z.string().trim().max(80).nullable().optional(),
  receiptPrinterPort: z.number().int().min(1).max(65535).optional(),
  receiptPrinterWidth: z.number().int().min(24).max(64).optional(),
});

export const PATCH = route(async (req: Request) => {
  const user = await requireUser("settings.manage");
  const d = await body(req, schema);
  await prisma.$transaction(async (tx) => {
    await tx.organization.update({ where: { id: user.organizationId }, data: { ...d, receiptPrinterHost: d.receiptPrinterHost === "" ? null : d.receiptPrinterHost } });
    await audit(tx, user.organizationId, user.id, "settings.update", `Cambió la configuración: ${Object.keys(d).join(", ")}`);
  });
});
