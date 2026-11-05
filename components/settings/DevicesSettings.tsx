"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChefHat, Monitor, Smartphone, Wallet } from "lucide-react";
import { Badge, Button, Input, Select, Sheet } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import { formatDate, formatTime } from "@/lib/utils";

type D = { id: string; name: string; kind: string; stationId: string | null; station: string | null; active: boolean; linked: boolean; code: string | null; codeExpires: string | null; lastSeenAt: string | null };

const KIND: Record<string, { label: string; desc: string; icon: typeof Monitor }> = {
  POS: { label: "Caja", desc: "La compu principal: cobra, salón, todo.", icon: Wallet },
  WAITER: { label: "Mozo", desc: "Tablet o celular para tomar pedidos. Se entra con PIN.", icon: Smartphone },
  KDS: { label: "Pantalla de cocina", desc: "Queda prendida mostrando las comandas de una estación. Sin PIN.", icon: ChefHat },
  DISPLAY: { label: "Pantalla de retiro", desc: "Para los clientes: qué número está listo.", icon: Monitor },
};

export function DevicesSettings({ devices, stations }: { devices: D[]; stations: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("WAITER");
  const [stationId, setStationId] = useState<string>(stations[0]?.id ?? "");
  const [code, setCode] = useState<{ name: string; code: string } | null>(null);

  async function create() {
    try {
      const r = await api<{ code: string }>("/api/devices", { body: { name, kind, stationId: kind === "KDS" ? stationId || null : null } });
      setCreating(false);
      setCode({ name, code: r.code });
      setName("");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  async function act(d: D, action: "newCode" | "unlink") {
    try {
      const r = await api<{ code?: string }>(`/api/devices/${d.id}`, { body: { action } });
      if (r.code) setCode({ name: d.name, code: r.code });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <PageContainer width="default">
      <PageHeader title="Equipos" back={{ href: "/configuracion", label: "Configuración" }} action={<Button size="sm" onClick={() => setCreating(true)}>Vincular equipo</Button>} />
      <div className="rounded-2xl border border-info-border bg-info-subtle p-4 text-sm text-info-strong mb-4 space-y-1">
        <p className="font-semibold">Cómo se arma el local</p>
        <p>1. La compu principal corre ronda (el servidor). 2. En cada tablet, celular o pantalla abrí en el navegador la dirección del servidor en la red del local (por ejemplo <b>http://192.168.0.10:3000/vincular</b>). 3. Escribí el código de 6 números que te da esta pantalla. Listo: el equipo queda vinculado y recuerda qué es.</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {devices.map((d) => {
          const K = KIND[d.kind] ?? KIND.WAITER!;
          return (
            <div key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                            <div className="flex-1 min-w-40">
                <p className="text-sm font-semibold text-text-primary">{d.name}</p>
                <p className="text-xs text-text-muted">{K.label}{d.station ? ` · ${d.station}` : ""}{d.lastSeenAt ? ` · visto ${formatDate(d.lastSeenAt)}` : ""}</p>
              </div>
              {d.code ? <Badge tone="warning">Código {d.code}</Badge> : d.linked ? <Badge tone="success">Vinculado</Badge> : <Badge>{d.active ? "Sin vincular" : "Desvinculado"}</Badge>}
              <Button size="sm" variant="outline" onClick={() => act(d, "newCode")}>Código</Button>
              {d.active && <Button size="sm" variant="ghost" onClick={() => act(d, "unlink")}>Desvincular</Button>}
            </div>
          );
        })}
        {devices.length === 0 && <p className="px-4 py-6 text-sm text-text-secondary text-center">Todavía no hay equipos vinculados.</p>}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="Vincular un equipo" maxWidth="max-w-md" footer={<Button fullWidth disabled={!name.trim()} onClick={create}>Generar código</Button>}>
        <div className="space-y-4">
          <Input label="Nombre" value={name} onChange={(e) => setName(e.target.value)} placeholder="Tablet terraza, Pantalla parrilla…" />
          <div className="space-y-1.5">
            {Object.entries(KIND).map(([k, v]) => (
              <button key={k} onClick={() => setKind(k)} className={`w-full text-left rounded-xl border px-3 py-2 flex items-center gap-3 ${kind === k ? "border-accent bg-accent-light" : "border-border hover:bg-surface-secondary"}`}>
                <span><span className="block text-sm font-semibold">{v.label}</span><span className="block text-xs text-text-secondary">{v.desc}</span></span>
              </button>
            ))}
          </div>
          {kind === "KDS" && <Select label="Estación que muestra" value={stationId} onChange={(e) => setStationId(e.target.value)} options={stations.map((s) => ({ value: s.id, label: s.name }))} />}
        </div>
      </Sheet>

      <Sheet open={!!code} onClose={() => setCode(null)} title={`Código para ${code?.name ?? ""}`} maxWidth="max-w-sm">
        <div className="text-center py-4">
                    <p className="text-5xl font-bold tracking-[0.3em] tabular-nums text-text-primary">{code?.code}</p>
          <p className="text-sm text-text-secondary mt-4">En el equipo, abrí <b>/vincular</b> y escribí este código. Vence a las {formatTime(new Date(Date.now() + 30 * 60_000))}.</p>
        </div>
      </Sheet>
    </PageContainer>
  );
}
