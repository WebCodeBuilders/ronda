"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Input, Select, Sheet } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Toggle } from "@/components/menu/ProductForm";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS, type Role } from "@/lib/permissions";
import { COLOR_LABEL, COLOR_OPTIONS, initials, solidColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

type U = { id?: string; name: string; role: string; color: string; email: string; active: boolean; hasPin: boolean };

export function UsersSettings({ users, me, isOwner }: { users: U[]; me: string; isOwner: boolean }) {
  const [edit, setEdit] = useState<U | null>(null);
  return (
    <PageContainer width="default">
      <PageHeader title="Usuarios y permisos" back={{ href: "/configuracion", label: "Configuración" }} action={<Button size="sm" onClick={() => setEdit({ name: "", role: "WAITER", color: "success", email: "", active: true, hasPin: false })}>Nuevo usuario</Button>} />
      <p className="text-sm text-text-secondary mb-3">Cada persona entra a las terminales con su PIN de 4 números. El dueño y el encargado pueden además entrar con email desde cualquier lado.</p>
      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {users.map((u) => (
          <button key={u.id} onClick={() => setEdit(u)} className={cn("w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary", !u.active && "opacity-60")}>
            <span className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold text-white" style={{ background: solidColor(u.color) }}>{initials(u.name)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{u.name}{u.id === me ? " (vos)" : ""}</p>
              <p className="text-xs text-text-muted truncate">{ROLE_LABELS[u.role as Role]}{u.email ? ` · ${u.email}` : ""}</p>
            </div>
            {u.hasPin && <Badge tone="neutral">Con PIN</Badge>}
            {!u.active && <Badge>Inactivo</Badge>}
          </button>
        ))}
      </div>
      {edit && <UserSheet user={edit} isOwner={isOwner} onClose={() => setEdit(null)} />}
    </PageContainer>
  );
}

function UserSheet({ user, isOwner, onClose }: { user: U; isOwner: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [u, setU] = useState(user);
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const roles = ROLES.filter((r) => isOwner || r !== "OWNER");
  async function save() {
    setBusy(true);
    try {
      const body = { name: u.name, role: u.role, color: u.color, email: u.email, active: u.active, pin, password };
      if (u.id) await api(`/api/users/${u.id}`, { method: "PUT", body });
      else await api("/api/users", { body });
      toast.success("Guardado");
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }
  const needsEmail = u.role === "OWNER" || u.role === "MANAGER";
  return (
    <Sheet open onClose={onClose} title={u.id ? u.name : "Nuevo usuario"} maxWidth="max-w-md" footer={<Button fullWidth loading={busy} disabled={!u.name.trim()} onClick={save}>Guardar</Button>}>
      <div className="space-y-4">
        <div className="grid grid-cols-[minmax(0,1fr)_9rem] gap-3">
          <Input label="Nombre" value={u.name} onChange={(e) => setU({ ...u, name: e.target.value })} />
          <Select label="Color" value={u.color} onChange={(e) => setU({ ...u, color: e.target.value })} options={COLOR_OPTIONS.map((c) => ({ value: c, label: COLOR_LABEL[c] }))} />
        </div>
        <div>
          <p className="text-sm font-medium mb-1.5">Rol</p>
          <div className="space-y-1.5">
            {roles.map((r) => (
              <button key={r} onClick={() => setU({ ...u, role: r })} className={cn("w-full text-left rounded-xl border px-3 py-2", u.role === r ? "border-accent bg-accent-light" : "border-border hover:bg-surface-secondary")}>
                <p className={cn("text-sm font-semibold", u.role === r ? "text-accent" : "text-text-primary")}>{ROLE_LABELS[r]}</p>
                <p className="text-xs text-text-secondary">{ROLE_DESCRIPTIONS[r]}</p>
              </button>
            ))}
          </div>
        </div>
        <Input label={u.hasPin ? "Nuevo PIN (dejalo vacío para no cambiarlo)" : "PIN de 4 números"} inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
        {(needsEmail || u.email) && (
          <>
            <Input label="Email (para entrar desde cualquier lado)" type="email" value={u.email} onChange={(e) => setU({ ...u, email: e.target.value })} />
            <Input label={u.id ? "Nueva contraseña (opcional)" : "Contraseña"} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </>
        )}
        {u.id && <Toggle label="Activo" hint="Desactivado no puede entrar. Su historial queda." checked={u.active} onChange={(v) => setU({ ...u, active: v })} />}
      </div>
    </Sheet>
  );
}
