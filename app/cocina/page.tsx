import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, getDevice } from "@/lib/auth/session";
import { loadKitchen } from "@/lib/kitchen/queries";
import { KitchenDisplay } from "@/components/kitchen/KitchenDisplay";

export const metadata = { title: "Cocina · ronda" };
export const dynamic = "force-dynamic";

/**
 * Pantalla de cocina / barra. Funciona con una persona logueada o con un
 * equipo vinculado como "Pantalla de cocina" (queda prendida todo el turno,
 * sin que nadie tenga que entrar).
 */
export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ estacion?: string }> }) {
  const user = await getCurrentUser();
  const device = user?.permissions.has("kitchen.view") ? null : await getDevice();
  if (user && !user.permissions.has("kitchen.view") && !(device && device.kind === "KDS")) redirect("/");
  if (!user && !(device && device.kind === "KDS")) redirect(device ? "/pin?next=/cocina" : "/login?next=/cocina");
  const orgId = user?.organizationId ?? device!.organizationId;
  const sp = await searchParams;
  const stationParam = sp.estacion === "todas" ? null : sp.estacion ?? device?.stationId ?? null;
  const [data, products] = await Promise.all([
    loadKitchen(orgId, stationParam),
    prisma.product.findMany({ where: { organizationId: orgId, active: true }, select: { id: true, name: true, available: true, category: { select: { name: true } } }, orderBy: [{ category: { sort: "asc" } }, { name: "asc" }] }),
  ]);
  return (
    <KitchenDisplay
      data={data}
      stationId={stationParam}
      deviceName={device?.name ?? null}
      userName={user?.name ?? null}
      products={products.map((p) => ({ id: p.id, name: p.name, available: p.available, category: p.category?.name ?? "Sin categoría" }))}
    />
  );
}
