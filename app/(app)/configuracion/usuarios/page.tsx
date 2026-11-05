import { prisma } from "@/lib/prisma";
import { pageUser } from "@/lib/auth/guard";
import { UsersSettings } from "@/components/settings/UsersSettings";

export const metadata = { title: "Usuarios · ronda" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await pageUser("users.manage");
  const users = await prisma.user.findMany({ where: { organizationId: user.organizationId }, orderBy: [{ active: "desc" }, { name: "asc" }], select: { id: true, name: true, role: true, color: true, email: true, active: true, pinHash: true } });
  return <UsersSettings me={user.id} isOwner={user.role === "OWNER"} users={users.map((u) => ({ id: u.id, name: u.name, role: u.role, color: u.color, email: u.email ?? "", active: u.active, hasPin: !!u.pinHash }))} />;
}
