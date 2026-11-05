import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { DevicesSettings } from "@/components/settings/DevicesSettings";

export const metadata = { title: "Equipos · ronda" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await pageUser("settings.manage");
  const [devices, stations] = await Promise.all([
    prisma.device.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }], include: { station: { select: { name: true } } } }),
    prisma.station.findMany({ where: { organizationId: user.organizationId, active: true }, orderBy: { sort: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <DevicesSettings
      stations={stations}
      devices={devices.map((d) => ({
        id: d.id, name: d.name, kind: d.kind, stationId: d.stationId, station: d.station?.name ?? null, active: d.active, linked: !!d.tokenHash,
        code: d.pairingCode && d.pairingExpires && d.pairingExpires > new Date() ? d.pairingCode : null, codeExpires: d.pairingExpires?.toISOString() ?? null, lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
      }))}
    />
  );
}
