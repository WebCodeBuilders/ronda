"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, List, Minus, Pencil, Plus, UserRound, Users } from "lucide-react";
import { Button, Sheet } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useLiveRefresh } from "@/lib/realtime/client";
import { api } from "@/lib/client/api";
import { TABLE_STATE_LABEL, TABLE_STATE_STYLE, type TableState } from "@/lib/salon/state";
import type { SalonData, SalonTable } from "@/lib/salon/queries";
import { formatCurrency, formatTime, cn } from "@/lib/utils";
import { TableShape, useElapsed } from "./TableShape";
import { SalonEditor } from "./SalonEditor";

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

const VIEW_KEY = "ronda_salon_view";

export function SalonView({ data, me, canEdit, canOpen, initialArea, initialEdit }: {
  data: SalonData; me: string; canEdit: boolean; canOpen: boolean; initialArea: string | null; initialEdit: boolean;
}) {
  useLiveRefresh(["tables.changed", "order.changed", "kitchen.changed", "request.new", "request.changed", "reservations.changed"]);
  const router = useRouter();
  const toast = useToast();
  const now = useNow();
  const [areaId, setAreaId] = useState(initialArea && data.areas.some((a) => a.id === initialArea) ? initialArea : data.areas[0]?.id ?? null);
  const [view, setView] = useState<"plan" | "list">("plan");
  const [onlyMine, setOnlyMine] = useState(false);
  const [editing, setEditing] = useState(initialEdit && canEdit);
  const [opening, setOpening] = useState<SalonTable | null>(null);

  // La vista se recuerda por equipo: la tablet del mozo queda en lista, la caja en plano.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "plan" || saved === "list") setView(saved);
      else if (window.matchMedia("(max-width: 640px)").matches) setView("list");
    } catch {
      /* sin storage */
    }
  }, []);
  function changeView(v: "plan" | "list") {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* sin storage */
    }
  }

  const area = data.areas.find((a) => a.id === areaId) ?? null;
  const tables = useMemo(
    () => data.tables.filter((t) => t.areaId === areaId && (!onlyMine || t.order?.waiterId === me)),
    [data.tables, areaId, onlyMine, me],
  );

  const counts = useMemo(() => {
    const all = data.tables;
    const busy = all.filter((t) => t.order);
    return {
      free: all.filter((t) => !t.order).length,
      busy: busy.length,
      guests: busy.reduce((s, t) => s + (t.order?.guests ?? 0), 0),
      attention: all.filter((t) => ["CALLING", "READY", "LATE"].includes(t.state)).length,
      byArea: new Map(data.areas.map((a) => [a.id, all.filter((t) => t.areaId === a.id && ["CALLING", "READY", "LATE"].includes(t.state)).length])),
    };
  }, [data]);

  function onTable(t: SalonTable) {
    if (t.order) router.push(`/pedidos/${t.order.id}`);
    else if (canOpen) setOpening(t);
    else toast.info("No tenés permiso para abrir mesas.");
  }

  if (editing && area) {
    return <SalonEditor data={data} areaId={area.id} onAreaChange={setAreaId} onExit={() => { setEditing(false); router.refresh(); }} />;
  }

  return (
    <PageContainer width="full">
      <PageHeader
        title="Salón"
        meta={
          <span className="text-sm text-text-secondary tabular-nums">
            {counts.busy} ocupadas · {counts.free} libres · {counts.guests} comensales
          </span>
        }
        action={
          <>
            <div className="flex rounded-xl border border-border bg-surface p-0.5">
              <button onClick={() => changeView("plan")} className={cn("flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-sm font-medium", view === "plan" ? "bg-accent-light text-accent" : "text-text-secondary")}>
                <LayoutGrid className="w-4 h-4" /> Plano
              </button>
              <button onClick={() => changeView("list")} className={cn("flex items-center gap-1.5 h-9 px-3 rounded-[10px] text-sm font-medium", view === "list" ? "bg-accent-light text-accent" : "text-text-secondary")}>
                <List className="w-4 h-4" /> Lista
              </button>
            </div>
            <Button variant={onlyMine ? "secondary" : "outline"} size="sm" onClick={() => setOnlyMine((v) => !v)} icon={<UserRound className="w-4 h-4" />}>
              Mis mesas
            </Button>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} icon={<Pencil className="w-4 h-4" />}>
                Editar plano
              </Button>
            )}
          </>
        }
      />

      <div className="snap-x-chips gap-2 mb-3">
        {data.areas.map((a) => {
          const alert = counts.byArea.get(a.id) ?? 0;
          return (
            <button
              key={a.id}
              onClick={() => setAreaId(a.id)}
              className={cn(
                "h-10 px-4 rounded-xl border text-sm font-semibold flex items-center gap-2 transition-colors",
                a.id === areaId ? "bg-accent text-white border-accent" : "bg-surface border-border text-text-secondary hover:bg-surface-secondary",
              )}
            >
              {a.name}
              {alert > 0 && <span className="min-w-5 h-5 px-1 rounded-full bg-error text-white text-[11px] flex items-center justify-center tabular-nums">{alert}</span>}
            </button>
          );
        })}
      </div>

      <Legend />

      {!area ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Todavía no hay sectores. {canEdit ? "Tocá \"Editar plano\" para crear el salón." : "Pedile al dueño que arme el plano."}
        </div>
      ) : view === "plan" ? (
        <div className="rounded-2xl border border-border bg-surface p-3 overflow-x-auto">
          <div className="relative mx-auto" style={{ aspectRatio: `${area.width} / ${area.height}`, minWidth: 560, maxWidth: 1200 }}>
            {tables.map((t) => (
              <PlanTable key={t.id} t={t} area={area} now={now} onClick={() => onTable(t)} />
            ))}
            {tables.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">{onlyMine ? "No tenés mesas en este sector." : "Sin mesas en este sector."}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
          {tables
            .slice()
            .sort((a, b) => priority(a.state) - priority(b.state) || a.name.localeCompare(b.name, "es", { numeric: true }))
            .map((t) => (
              <ListTable key={t.id} t={t} now={now} onClick={() => onTable(t)} />
            ))}
          {tables.length === 0 && <p className="col-span-full text-sm text-text-muted py-8 text-center">{onlyMine ? "No tenés mesas en este sector." : "Sin mesas en este sector."}</p>}
        </div>
      )}

      {opening && <OpenTableSheet table={opening} onClose={() => setOpening(null)} />}
    </PageContainer>
  );
}

function priority(s: TableState) {
  return ["CALLING", "READY", "LATE", "BILLING", "OCCUPIED", "RESERVED", "FREE"].indexOf(s);
}

function Legend() {
  const states: TableState[] = ["FREE", "OCCUPIED", "READY", "LATE", "BILLING", "CALLING", "RESERVED"];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs text-text-secondary">
      {states.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: TABLE_STATE_STYLE[s].dot }} />
          {TABLE_STATE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

function PlanTable({ t, area, now, onClick }: { t: SalonTable; area: { width: number; height: number }; now: number | null; onClick: () => void }) {
  const elapsed = useElapsed(t.order?.openedAt, now);
  return (
    <button
      onClick={onClick}
      className="absolute fs-press focus-visible:outline-none"
      style={{
        left: `${(t.x / area.width) * 100}%`,
        top: `${(t.y / area.height) * 100}%`,
        width: `${(t.w / area.width) * 100}%`,
        height: `${(t.h / area.height) * 100}%`,
        transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
      }}
    >
      <TableShape
        name={t.name}
        shape={t.shape}
        seats={t.seats}
        state={t.state}
        guests={t.order?.guests}
        elapsed={elapsed}
        waiter={t.order?.waiterName ? { name: t.order.waiterName, color: t.order.waiterColor } : null}
        readyItems={t.order?.readyItems}
        draftItems={t.order?.draftItems}
        reservation={t.reservation ? `${formatTime(t.reservation.dateTime)} ${t.reservation.name}` : null}
        compact={t.w < 75 || t.h < 75}
      />
    </button>
  );
}

function ListTable({ t, now, onClick }: { t: SalonTable; now: number | null; onClick: () => void }) {
  const elapsed = useElapsed(t.order?.openedAt, now);
  const st = TABLE_STATE_STYLE[t.state];
  const urgent = ["CALLING", "READY", "LATE"].includes(t.state);
  return (
    <button
      onClick={onClick}
      className={cn("fs-press text-left rounded-2xl border-2 p-3 min-h-24 flex flex-col", urgent && "rd-pulse")}
      style={{ background: st.bg, borderColor: st.border, ["--pulse-color" as string]: st.dot }}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-2xl font-bold leading-none tabular-nums" style={{ color: st.text }}>{t.name}</span>
        {t.order && <span className="text-xs font-semibold tabular-nums text-text-secondary">{elapsed}</span>}
      </div>
      <span className="text-xs font-semibold mt-1.5" style={{ color: st.text }}>{TABLE_STATE_LABEL[t.state]}</span>
      <div className="mt-auto pt-2 text-xs text-text-secondary flex items-center justify-between gap-2">
        {t.order ? (
          <>
            <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {t.order.guests} · {t.order.waiterName?.split(" ")[0] ?? "—"}</span>
            <span className="font-semibold tabular-nums text-text-primary">{formatCurrency(t.order.total)}</span>
          </>
        ) : t.reservation ? (
          <span className="truncate">{formatTime(t.reservation.dateTime)} · {t.reservation.name} ({t.reservation.partySize})</span>
        ) : (
          <span>{t.seats} lugares</span>
        )}
      </div>
    </button>
  );
}

function OpenTableSheet({ table, onClose }: { table: SalonTable; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [guests, setGuests] = useState(Math.min(table.seats, 2));
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const r = await api<{ id: string }>("/api/orders", { body: { type: "DINE_IN", tableId: table.id, guests } });
      router.push(`/pedidos/${r.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Abrir mesa ${table.name}`}
      description={table.reservation ? `Reservada ${formatTime(table.reservation.dateTime)} · ${table.reservation.name}` : `${table.seats} lugares`}
      maxWidth="max-w-sm"
      footer={
        <Button fullWidth size="lg" loading={busy} onClick={open}>
          Abrir mesa
        </Button>
      }
    >
      <p className="text-sm font-medium text-text-primary mb-3">¿Cuántos son?</p>
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => setGuests((g) => Math.max(1, g - 1))} className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center hover:bg-surface-secondary" aria-label="Menos">
          <Minus className="w-6 h-6" />
        </button>
        <span className="text-5xl font-bold tabular-nums w-20 text-center text-text-primary">{guests}</span>
        <button onClick={() => setGuests((g) => Math.min(99, g + 1))} className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center hover:bg-surface-secondary" aria-label="Más">
          <Plus className="w-6 h-6" />
        </button>
      </div>
      <div className="grid grid-cols-6 gap-2 mt-4">
        {[1, 2, 3, 4, 5, 6].map((n) => (
          <button key={n} onClick={() => setGuests(n)} className={cn("h-11 rounded-xl border text-sm font-semibold tabular-nums", guests === n ? "bg-accent text-white border-accent" : "border-border text-text-secondary hover:bg-surface-secondary")}>
            {n}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
