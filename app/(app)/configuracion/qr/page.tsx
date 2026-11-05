import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { publicUrl } from "@/lib/public-url";
import { QrSheet } from "@/components/settings/QrSheet";
import { naturalCompare } from "@/lib/colors";

export const metadata = { title: "QR de las mesas · ronda" };

export default async function Page() {
  const user = await pageUser("settings.manage");
  const base = await publicUrl();
  const [org, tables] = await Promise.all([
    prisma.organization.findUniqueOrThrow({ where: { id: user.organizationId }, select: { name: true } }),
    prisma.diningTable.findMany({ where: { organizationId: user.organizationId, active: true }, include: { area: { select: { name: true, sort: true } } }, orderBy: [{ area: { sort: "asc" } }, { name: "asc" }] }),
  ]);
  // Agrupadas por sector y en orden natural: 1, 2, 10.
  tables.sort((a, b) => a.area.sort - b.area.sort || naturalCompare(a.name, b.name));
  const items = await Promise.all(
    tables.map(async (t) => {
      const url = `${base}/m/${t.qrToken}`;
      const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0A3D62", light: "#FFFFFF" } });
      return { id: t.id, name: t.name, area: t.area.name, url, svg };
    }),
  );
  return <QrSheet orgName={org.name} base={base} items={items} />;
}
