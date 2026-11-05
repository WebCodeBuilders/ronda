import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { PaymentMethodsSettings } from "@/components/settings/PaymentMethodsSettings";

export const metadata = { title: "Medios de pago · ronda" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await pageUser("settings.manage");
  const methods = await prisma.paymentMethod.findMany({ where: { organizationId: user.organizationId }, orderBy: { sort: "asc" } });
  return <PaymentMethodsSettings methods={methods.map((m) => ({ id: m.id, name: m.name, kind: m.kind, adjustPct: m.adjustPct, active: m.active }))} />;
}
