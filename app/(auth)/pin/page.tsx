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
  // Primero quienes usan este equipo: en la tablet del mozo, los mozos; en la caja, quien cobra.
  const rank: Record<string, string[]> = {
    WAITER: ["WAITER", "MANAGER", "CASHIER", "OWNER", "KITCHEN", "DELIVERY"],
    KDS: ["KITCHEN", "MANAGER", "OWNER", "CASHIER", "WAITER", "DELIVERY"],
    POS: ["CASHIER", "MANAGER", "OWNER", "WAITER", "DELIVERY", "KITCHEN"],
    DISPLAY: ["CASHIER", "MANAGER", "OWNER", "WAITER", "KITCHEN", "DELIVERY"],
  };
  const order = rank[device.kind] ?? rank.POS!;
  users.sort((a, b) => order.indexOf(a.role) - order.indexOf(b.role) || a.name.localeCompare(b.name, "es"));
  return <PinPad users={users} deviceName={device.name} orgName={org.name} next={next ?? null} />;
}
