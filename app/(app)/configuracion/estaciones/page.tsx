import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { StationsSettings } from "@/components/settings/StationsSettings";

export const metadata = { title: "Estaciones · ronda" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await pageUser("settings.manage");
  const [stations, failed] = await Promise.all([
    prisma.station.findMany({ where: { organizationId: user.organizationId, active: true }, orderBy: { sort: "asc" } }),
    prisma.printJob.findMany({ where: { organizationId: user.organizationId, status: { in: ["FAILED", "PENDING"] }, host: { not: null } }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, lastError: true, attempts: true, createdAt: true, status: true } }),
  ]);
  return (
    <StationsSettings
      stations={stations.map((s) => ({ id: s.id, name: s.name, color: s.color, kdsEnabled: s.kdsEnabled, printerEnabled: s.printerEnabled, printerHost: s.printerHost ?? "", printerPort: s.printerPort, printerWidth: s.printerWidth, printerCopies: s.printerCopies }))}
      failed={failed.map((f) => ({ ...f, createdAt: f.createdAt.toISOString() }))}
    />
  );
}
