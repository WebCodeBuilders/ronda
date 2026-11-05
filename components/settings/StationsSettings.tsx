"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Plus, Printer, RotateCcw, Trash2, Monitor } from "lucide-react";
import { Badge, Button, Input, Select, Sheet } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Toggle } from "@/components/menu/ProductForm";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import { COLOR_LABEL, COLOR_OPTIONS, solidColor } from "@/lib/colors";
import { formatDate } from "@/lib/utils";

type St = { id?: string; name: string; color: string; kdsEnabled: boolean; printerEnabled: boolean; printerHost: string; printerPort: number; printerWidth: number; printerCopies: number };

export function StationsSettings({ stations, failed }: { stations: St[]; failed: { id: string; title: string; lastError: string | null; attempts: number; createdAt: string; status: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<St | null>(null);

  async function retry(id: string) {
    try {
      await api(`/api/print/${id}/retry`, { body: {} });
      toast.success("Impreso");
    } catch (e) {
      toast.error((e as Error).message);
    }
    router.refresh();
  }

  return (
    <PageContainer width="default">
      <PageHeader title="Estaciones e impresoras" back={{ href: "/configuracion", label: "Configuración" }} action={<Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setEdit({ name: "", color: "accent", kdsEnabled: true, printerEnabled: false, printerHost: "", printerPort: 9100, printerWidth: 42, printerCopies: 1 })}>Nueva estación</Button>} />
      <p className="text-sm text-text-secondary mb-3">Cada estación recibe sus comandas en una pantalla (KDS), en una comandera térmica de red, o en las dos. Si la impresora falla, la comanda no se pierde: se reintenta sola y la pantalla la sigue mostrando.</p>
      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {stations.map((s) => (
          <button key={s.id} onClick={() => setEdit(s)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary">
            <span className="w-9 h-9 rounded-xl flex items-center justify-center text-white" style={{ background: solidColor(s.color) }}><ChefHat className="w-4 h-4" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-text-primary">{s.name}</p>
              <p className="text-xs text-text-muted">{s.printerEnabled && s.printerHost ? `Comandera ${s.printerHost}:${s.printerPort}` : "Sin comandera"}</p>
            </div>
            {s.kdsEnabled && <Badge tone="info"><Monitor className="w-3 h-3" /> Pantalla</Badge>}
            {s.printerEnabled && <Badge tone="accent"><Printer className="w-3 h-3" /> Impresora</Badge>}
          </button>
        ))}
      </div>
      {failed.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Impresiones pendientes o con error</h2>
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {failed.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">{f.title}</p>
                  <p className="text-xs text-text-muted">{formatDate(f.createdAt)} · {f.attempts} intentos · {f.lastError ?? "pendiente"}</p>
                </div>
                <Button size="sm" variant="outline" icon={<RotateCcw className="w-4 h-4" />} onClick={() => retry(f.id)}>Reintentar</Button>
              </div>
            ))}
          </div>
        </div>
      )}
      {edit && <StationSheet station={edit} onClose={() => setEdit(null)} />}
    </PageContainer>
  );
}

function StationSheet({ station, onClose }: { station: St; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [s, setS] = useState(station);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof St>(k: K, v: St[K]) => setS((x) => ({ ...x, [k]: v }));
  const payload = () => ({ name: s.name, color: s.color, kdsEnabled: s.kdsEnabled, printerEnabled: s.printerEnabled, printerHost: s.printerHost || null, printerPort: s.printerPort, printerWidth: s.printerWidth, printerCopies: s.printerCopies });

  async function save() {
    setBusy(true);
    try {
      if (s.id) await api(`/api/stations/${s.id}`, { method: "PUT", body: payload() });
      else await api("/api/stations", { body: payload() });
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }
  async function test() {
    try {
      if (s.id) await api(`/api/stations/${s.id}`, { method: "PUT", body: payload() });
      await api(`/api/stations/${s.id}/test`, { body: {} });
      toast.success("Salió la prueba por la comandera");
    } catch (e) {
      toast.error("La comandera no respondió", (e as Error).message);
    }
  }
  async function remove() {
    try {
      await api(`/api/stations/${s.id}`, { method: "DELETE" });
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <Sheet open onClose={onClose} title={s.id ? s.name : "Nueva estación"} maxWidth="max-w-lg"
      footer={<div className="flex gap-2">{s.id && <Button variant="danger-outline" icon={<Trash2 className="w-4 h-4" />} onClick={remove}>Quitar</Button>}<Button className="flex-1" loading={busy} disabled={!s.name.trim()} onClick={save}>Guardar</Button></div>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Nombre" value={s.name} onChange={(e) => set("name", e.target.value)} placeholder="Cocina, Barra, Parrilla…" />
          <Select label="Color" value={s.color} onChange={(e) => set("color", e.target.value)} options={COLOR_OPTIONS.map((c) => ({ value: c, label: COLOR_LABEL[c] }))} />
        </div>
        <Toggle label="Pantalla de cocina (KDS)" hint="Las comandas aparecen en /cocina." checked={s.kdsEnabled} onChange={(v) => set("kdsEnabled", v)} />
        <Toggle label="Comandera térmica de red" hint="Epson, Hasar, 3nStar, Xprinter: ESC/POS por red, puerto 9100." checked={s.printerEnabled} onChange={(v) => set("printerEnabled", v)} />
        {s.printerEnabled && (
          <>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <Input label="IP de la comandera" placeholder="192.168.0.60" value={s.printerHost} onChange={(e) => set("printerHost", e.target.value)} />
              <Input label="Puerto" type="number" value={s.printerPort} onChange={(e) => set("printerPort", Number(e.target.value) || 9100)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Papel" value={String(s.printerWidth)} onChange={(e) => set("printerWidth", Number(e.target.value))} options={[{ value: "42", label: "80 mm (42)" }, { value: "48", label: "80 mm (48)" }, { value: "32", label: "58 mm (32)" }]} />
              <Select label="Copias" value={String(s.printerCopies)} onChange={(e) => set("printerCopies", Number(e.target.value))} options={[1, 2, 3].map((n) => ({ value: String(n), label: String(n) }))} />
            </div>
            {s.id && <Button variant="outline" size="sm" icon={<Printer className="w-4 h-4" />} onClick={test} disabled={!s.printerHost}>Guardar e imprimir prueba</Button>}
          </>
        )}
      </div>
    </Sheet>
  );
}
