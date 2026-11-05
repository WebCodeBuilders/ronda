"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge, Button, Input, Select, Sheet } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Toggle } from "@/components/menu/ProductForm";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import { PAYMENT_KIND_LABEL } from "@/lib/orders/labels";

type M = { id?: string; name: string; kind: string; adjustPct: number; active: boolean };

export function PaymentMethodsSettings({ methods }: { methods: M[] }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<M | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!edit) return;
    setBusy(true);
    try {
      const body = { name: edit.name, kind: edit.kind, adjustPct: edit.adjustPct, active: edit.active };
      if (edit.id) await api(`/api/payment-methods/${edit.id}`, { method: "PUT", body });
      else await api("/api/payment-methods", { body });
      router.refresh();
      setEdit(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageContainer width="default">
      <PageHeader title="Medios de pago" back={{ href: "/configuracion", label: "Configuración" }} action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setEdit({ name: "", kind: "CARD", adjustPct: 0, active: true })}>Nuevo</Button>} />
      <p className="text-sm text-text-secondary mb-3">Lo que el cajero ve al cobrar. El recargo (o descuento) se suma aparte, así la venta del plato no cambia según cómo se pague.</p>
      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {methods.map((m) => (
          <button key={m.id} onClick={() => setEdit(m)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary">
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">{m.name}</p>
              <p className="text-xs text-text-muted">{PAYMENT_KIND_LABEL[m.kind]}{m.adjustPct ? ` · ${m.adjustPct > 0 ? "recargo" : "descuento"} ${Math.abs(m.adjustPct)} %` : ""}</p>
            </div>
            {!m.active && <Badge>Inactivo</Badge>}
          </button>
        ))}
      </div>
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title={edit.id ? edit.name : "Nuevo medio de pago"} maxWidth="max-w-sm" footer={<Button fullWidth loading={busy} disabled={!edit.name.trim()} onClick={save}>Guardar</Button>}>
          <div className="space-y-4">
            <Input label="Nombre" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Crédito 3 cuotas, Modo, Cuenta DNI…" />
            <Select label="Tipo" value={edit.kind} onChange={(e) => setEdit({ ...edit, kind: e.target.value })} options={Object.entries(PAYMENT_KIND_LABEL).map(([value, label]) => ({ value, label }))} hint="Efectivo suma al cajón; Cuenta corriente pide cliente." />
            <Input label="Recargo / descuento (%)" type="number" value={edit.adjustPct} onChange={(e) => setEdit({ ...edit, adjustPct: Number(e.target.value) || 0 })} hint="10 = recargo del 10 %. −10 = descuento." />
            <Toggle label="Activo" checked={edit.active} onChange={(v) => setEdit({ ...edit, active: v })} />
          </div>
        </Sheet>
      )}
    </PageContainer>
  );
}
