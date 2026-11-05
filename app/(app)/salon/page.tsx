import { pageUser } from "@/lib/auth/guard";
import { loadSalon } from "@/lib/salon/queries";
import { SalonView } from "@/components/salon/SalonView";

export const metadata = { title: "Salón · ronda" };
export const dynamic = "force-dynamic";

export default async function SalonPage({ searchParams }: { searchParams: Promise<{ area?: string; editar?: string }> }) {
  const user = await pageUser("salon.view");
  const sp = await searchParams;
  const data = await loadSalon(user.organizationId);
  return (
    <SalonView
      data={data}
      me={user.id}
      canEdit={user.permissions.has("settings.manage")}
      canOpen={user.permissions.has("orders.create")}
      initialArea={sp.area ?? null}
      initialEdit={sp.editar === "1"}
    />
  );
}
