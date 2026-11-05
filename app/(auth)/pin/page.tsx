import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getDevice } from "@/lib/auth/session";
import { PinPad } from "./PinPad";

export const metadata = { title: "¿Quién sos? · ronda" };

export default async function PinPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const device = await getDevice();
  if (!device) redirect("/vincular");
  const { next } = await searchParams;
  const users = await prisma.user.findMany({
    where: { organizationId: device.organizationId, active: true, pinHash: { not: null } },
    select: { id: true, name: true, role: true, color: true },
    orderBy: { name: "asc" },
  });
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: device.organizationId }, select: { name: true } });
  return <PinPad users={users} deviceName={device.name} orgName={org.name} next={next ?? null} />;
}
