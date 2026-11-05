import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { BusinessSettings } from "@/components/settings/BusinessSettings";

export const metadata = { title: "Negocio · ronda" };

export default async function Page() {
  const user = await pageUser("settings.manage");
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId } });
  return (
    <BusinessSettings
      initial={{
        name: org.name, kind: org.kind, address: org.address ?? "", phone: org.phone ?? "", taxId: org.taxId ?? "", serviceChargePerGuest: org.serviceChargePerGuest,
        suggestedTipPct: org.suggestedTipPct, kitchenLateMinutes: org.kitchenLateMinutes, voidNeedsManager: org.voidNeedsManager, qrOrderingEnabled: org.qrOrderingEnabled,
        qrOrderNeedsApproval: org.qrOrderNeedsApproval, pesosPerPoint: org.pesosPerPoint, ticketFooter: org.ticketFooter ?? "",
        receiptPrinterHost: org.receiptPrinterHost ?? "", receiptPrinterPort: org.receiptPrinterPort, receiptPrinterWidth: org.receiptPrinterWidth,
      }}
    />
  );
}
