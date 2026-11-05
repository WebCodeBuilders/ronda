import { pageUser } from "@/lib/auth/guard";
import { AppShell } from "@/components/layout/AppShell";
import { visibleNav } from "@/components/layout/nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await pageUser();
  const groups = visibleNav(user.permissions);
  return (
    <AppShell
      user={{ id: user.id, name: user.name, role: user.role, color: user.color, orgName: user.organizationName, onDevice: !!user.deviceId }}
      groups={groups}
    >
      {children}
    </AppShell>
  );
}
