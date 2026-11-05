"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, RotateCw, Trash2, Pencil, QrCode } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { TextPromptModal } from "@/components/shared/TextPromptModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import { TABLE_SHAPE_LABEL } from "@/lib/orders/labels";
import type { SalonData, SalonTable } from "@/lib/salon/queries";
import { cn } from "@/lib/utils";
import { TableShape } from "./TableShape";

const SNAP = 10;
const snap = (n: number) => Math.round(n / SNAP) * SNAP;

const PRESETS: Record<string, { w: number; h: number; seats: number }> = {
  SQUARE: { w: 100, h: 100, seats: 4 },
  ROUND: { w: 100, h: 100, seats: 4 },
  RECT: { w: 160, h: 100, seats: 6 },
  BAR: { w: 60, h: 60, seats: 1 },
  BOOTH: { w: 140, h: 90, seats: 4 },
  UMBRELLA: { w: 110, h: 110, seats: 4 },
  LOUNGER: { w: 120, h: 60, seats: 2 },
};

/**
 * Editor del plano: se arrastran las mesas, se cambian de forma y tamaño, se
 * agregan sectores. Cada cambio se guarda solo, y las demás terminales lo ven
 * al instante.
 */
export function SalonEditor({ data, areaId, onAreaChange, onExit }: { data: SalonData; areaId: string; onAreaChange: (id: string) => void; onExit: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const area = data.areas.find((a) => a.id === areaId)!;
  const [tables, setTables] = useState<SalonTable[]>(() => data.tables);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<null | "newArea" | "renameArea">(null);
  const [confirmDelete, setConfirmDelete] = useState<null | "table" | "area">(null);
  const canvas = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; mode: "move" | "resize"; startX: number; startY: number; orig: SalonTable; scale: number } | null>(null);

  const areaTables = tables.filter((t) => t.areaId === areaId);
  const selected = tables.find((t) => t.id === selectedId) ?? null;

  async function patch(id: string, data: Partial<SalonTable>) {
    try {
      await api(`/api/tables/${id}`, { method: "PATCH", body: data });
    } catch (e) {
      toast.error((e as Error).message);
      router.refresh();
    }
  }

  function update(id: string, data: Partial<SalonTable>, save = true) {
    setTables((ts) => ts.map((t) => (t.id === id ? { ...t, ...data } : t)));
    if (save) patch(id, data);
  }

  function onPointerDown(e: React.PointerEvent, t: SalonTable, mode: "move" | "resize") {
    e.stopPropagation();
    e.preventDefault();
    setSelectedId(t.id);
    const rect = canvas.current!.getBoundingClientRect();
    drag.current = { id: t.id, mode, startX: e.clientX, startY: e.clientY, orig: t, scale: area.width / rect.width };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.startX) * d.scale;
    const dy = (e.clientY - d.startY) * d.scale;
    if (d.mode === "move") {
      const x = Math.min(area.width - d.orig.w, Math.max(0, snap(d.orig.x + dx)));
      const y = Math.min(area.height - d.orig.h, Math.max(0, snap(d.orig.y + dy)));
      update(d.id, { x, y }, false);
    } else {
      const w = Math.max(40, Math.min(600, snap(d.orig.w + dx)));
      const h = Math.max(40, Math.min(600, snap(d.orig.h + dy)));
      update(d.id, { w, h }, false);
    }
  }

  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const t = tables.find((x) => x.id === d.id);
    if (!t) return;
    if (d.mode === "move" && (t.x !== d.orig.x || t.y !== d.orig.y)) patch(t.id, { x: t.x, y: t.y });
    if (d.mode === "resize" && (t.w !== d.orig.w || t.h !== d.orig.h)) patch(t.id, { w: t.w, h: t.h });
  }

  async function addTable(shape: string) {
    const p = PRESETS[shape]!;
    const used = new Set(tables.map((t) => t.name));
    let n = tables.length + 1;
    const prefix = shape === "UMBRELLA" ? "S" : shape === "LOUNGER" ? "R" : shape === "BAR" ? "B" : "";
    while (used.has(`${prefix}${n}`)) n++;
    try {
      const r = await api<{ id: string }>("/api/tables", { body: { areaId, name: `${prefix}${n}`, shape, seats: p.seats, w: p.w, h: p.h, x: 20, y: 20 } });
      setTables((ts) => [...ts, { id: r.id, name: `${prefix}${n}`, areaId, shape, seats: p.seats, x: 20, y: 20, w: p.w, h: p.h, rotation: 0, state: "FREE", order: null, reservation: null }]);
      setSelectedId(r.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function deleteTable() {
    if (!selected) return;
    try {
      await api(`/api/tables/${selected.id}`, { method: "DELETE" });
      setTables((ts) => ts.filter((t) => t.id !== selected.id));
      setSelectedId(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setConfirmDelete(null);
  }

  async function areaPrompt(name: string) {
    try {
      if (prompt === "newArea") {
        const r = await api<{ id: string }>("/api/areas", { body: { name } });
        router.refresh();
        onAreaChange(r.id);
      } else {
        await api(`/api/areas/${areaId}`, { method: "PATCH", body: { name } });
        router.refresh();
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
    setPrompt(null);
  }

  async function deleteArea() {
    try {
      await api(`/api/areas/${areaId}`, { method: "DELETE" });
      const other = data.areas.find((a) => a.id !== areaId);
      router.refresh();
      if (other) onAreaChange(other.id);
    } catch (e) {
      toast.error((e as Error).message);
    }
    setConfirmDelete(null);
  }

  return (
    <PageContainer width="full">
      <PageHeader
        title="Editar plano"
        description="Arrastrá las mesas. Los cambios se guardan solos y se ven en todas las terminales."
        action={
          <>
            <Button variant="outline" size="sm" icon={<QrCode className="w-4 h-4" />} onClick={() => window.open("/configuracion/qr", "_blank")}>QR de mesas</Button>
            <Button size="sm" icon={<Check className="w-4 h-4" />} onClick={onExit}>Listo</Button>
          </>
        }
      />
      <div className="snap-x-chips gap-2 mb-3">
        {data.areas.map((a) => (
          <button key={a.id} onClick={() => { onAreaChange(a.id); setSelectedId(null); }} className={cn("h-10 px-4 rounded-xl border text-sm font-semibold", a.id === areaId ? "bg-accent text-white border-accent" : "bg-surface border-border text-text-secondary hover:bg-surface-secondary")}>
            {a.name}
          </button>
        ))}
        <button onClick={() => setPrompt("newArea")} className="h-10 px-4 rounded-xl border border-dashed border-border-strong text-sm font-semibold text-accent flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Sector
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap gap-2">
            {Object.keys(PRESETS).map((s) => (
              <Button key={s} variant="outline" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => addTable(s)}>
                {TABLE_SHAPE_LABEL[s]}
              </Button>
            ))}
          </div>
          <div className="rounded-2xl border border-border bg-surface p-3 overflow-x-auto">
            <div
              ref={canvas}
              className="relative mx-auto rd-grid rounded-xl touch-none"
              style={{ aspectRatio: `${area.width} / ${area.height}`, minWidth: 560, maxWidth: 1200 }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              onPointerDown={() => setSelectedId(null)}
            >
              {areaTables.map((t) => (
                <div
                  key={t.id}
                  className="absolute cursor-move"
                  style={{ left: `${(t.x / area.width) * 100}%`, top: `${(t.y / area.height) * 100}%`, width: `${(t.w / area.width) * 100}%`, height: `${(t.h / area.height) * 100}%`, transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined }}
                  onPointerDown={(e) => onPointerDown(e, t, "move")}
                >
                  <TableShape name={t.name} shape={t.shape} seats={t.seats} state={t.order ? "OCCUPIED" : "FREE"} selected={t.id === selectedId} compact={t.w < 75 || t.h < 75} />
                  {t.id === selectedId && (
                    <span
                      className="absolute -right-2 -bottom-2 w-5 h-5 rounded-md bg-accent border-2 border-surface cursor-nwse-resize"
                      onPointerDown={(e) => onPointerDown(e, t, "resize")}
                      aria-label="Cambiar tamaño"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-3">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-text-primary">Sector: {area.name}</h2>
              <div className="flex gap-1">
                <button onClick={() => setPrompt("renameArea")} className="tap-44 flex items-center justify-center rounded-xl text-text-secondary hover:bg-surface-secondary" aria-label="Renombrar sector"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => setConfirmDelete("area")} className="tap-44 flex items-center justify-center rounded-xl text-error hover:bg-error-subtle" aria-label="Borrar sector"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            <p className="text-xs text-text-muted mt-1">{areaTables.length} mesas · {areaTables.reduce((s, t) => s + t.seats, 0)} lugares</p>
          </div>
          {selected ? (
            <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
              <h2 className="text-sm font-semibold text-text-primary">Mesa {selected.name}</h2>
              <Input label="Nombre" value={selected.name} maxLength={12} onChange={(e) => update(selected.id, { name: e.target.value }, false)} onBlur={(e) => patch(selected.id, { name: e.target.value.trim() })} />
              <div className="grid grid-cols-2 gap-2">
                <Input label="Lugares" type="number" min={1} max={40} value={selected.seats} onChange={(e) => update(selected.id, { seats: Math.max(1, Number(e.target.value) || 1) })} />
                <Select label="Forma" value={selected.shape} onChange={(e) => update(selected.id, { shape: e.target.value })} options={Object.entries(TABLE_SHAPE_LABEL).map(([value, label]) => ({ value, label }))} />
              </div>
              <Select label="Sector" value={selected.areaId} onChange={(e) => update(selected.id, { areaId: e.target.value })} options={data.areas.map((a) => ({ value: a.id, label: a.name }))} />
              <div className="flex gap-2">
                <Button variant="outline" size="sm" icon={<RotateCw className="w-4 h-4" />} onClick={() => update(selected.id, { rotation: ((selected.rotation ?? 0) + 45) % 360 })}>Girar</Button>
                <Button variant="danger-outline" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={() => setConfirmDelete("table")}>Quitar</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary px-1">Tocá una mesa para cambiarle el nombre, la forma o los lugares. Arrastrá la esquina azul para cambiar el tamaño.</p>
          )}
        </aside>
      </div>

      {prompt && (
        <TextPromptModal
          title={prompt === "newArea" ? "Nuevo sector" : "Renombrar sector"}
          label="Nombre"
          placeholder="Terraza, Deck, Barra…"
          confirmLabel="Guardar"
          onConfirm={areaPrompt}
          onClose={() => setPrompt(null)}
        />
      )}
      {confirmDelete === "table" && selected && (
        <ConfirmDialog title={`Quitar la mesa ${selected.name}`} confirmLabel="Quitar" tone="danger" onConfirm={deleteTable} onClose={() => setConfirmDelete(null)}>
          La mesa deja de aparecer en el salón. Las ventas que tuvo siguen en los reportes.
        </ConfirmDialog>
      )}
      {confirmDelete === "area" && (
        <ConfirmDialog title={`Borrar el sector ${area.name}`} confirmLabel="Borrar" tone="danger" onConfirm={deleteArea} onClose={() => setConfirmDelete(null)}>
          Solo se puede borrar un sector vacío. Si tiene mesas, pasalas a otro sector primero.
        </ConfirmDialog>
      )}
    </PageContainer>
  );
}
