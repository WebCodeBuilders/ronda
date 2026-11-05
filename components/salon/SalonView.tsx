"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus } from "lucide-react";
import { Button, Sheet } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button-styles";
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
const URGENT: TableState[] = ["CALLING", "READY", "LATE", "BILLING"];
const PRIORITY: TableState[] = ["CALLING", "READY", "LATE", "BILLING", "OCCUPIED", "RESERVED", "FREE"];

/**
 * El salón en vivo. Escritorio: el plano entero en la pantalla y, al costado,
 * la fila de lo que necesita a alguien. Celular: lista ordenada por urgencia,
 * con las mesas libres compactas al final.
 */
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
  const [hover, setHover] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  // La vista se recuerda por equipo: la tablet del mozo queda en lista, la caja en plano.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(VIEW_KEY);
      if (saved === "plan" || saved === "list") setView(saved);
      else if (window.matchMedia("(max-width: 1023px)").matches) setView("list");
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
  const tables = useMemo(() => data.tables.filter((t) => t.areaId === areaId && (!onlyMine || t.order?.waiterId === me)), [data.tables, areaId, onlyMine, me]);
  const urgent = useMemo(
    () => data.tables.filter((t) => URGENT.includes(t.state) && (!onlyMine || t.order?.waiterId === me)).sort((a, b) => PRIORITY.indexOf(a.state) - PRIORITY.indexOf(b.state)),
    [data.tables, onlyMine, me],
  );
  const busy = data.tables.filter((t) => t.order);
  const guests = busy.reduce((s, t) => s + (t.order?.guests ?? 0), 0);
  const alertsByArea = new Map(data.areas.map((a) => [a.id, data.tables.filter((t) => t.areaId === a.id && URGENT.includes(t.state)).length]));
  const busyByArea = new Map(data.areas.map((a) => [a.id, data.tables.filter((t) => t.areaId === a.id && t.order).length]));

  function onTable(t: SalonTable) {
    if (t.order) router.push(`/pedidos/${t.order.id}`);
    else if (canOpen) setOpening(t);
    else toast.info("No tenés permiso para abrir mesas.");
  }

  if (editing && area) {
    return <SalonEditor data={data} areaId={area.id} onAreaChange={setAreaId} onExit={() => { setEditing(false); router.refresh(); }} />;
  }

  const hovered = hover ? data.tables.find((t) => t.id === hover) ?? null : null;

  return (
    <div className="w-full">
      {/* Encabezado compacto: título y números a la izquierda, controles a la derecha. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">Salón</h1>
          <p className="text-sm text-text-secondary tabular-nums whitespace-nowrap">
            <b className="text-text-primary">{busy.length}</b> ocupadas · {guests} personas
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Segmented value={view} onChange={changeView} options={[["plan", "Plano"], ["list", "Lista"]]} />
          <button onClick={() => setOnlyMine((v) => !v)} className={cn("h-9 px-3 rounded-xl border text-sm font-semibold", onlyMine ? "bg-accent text-white border-accent" : "bg-surface border-border text-text-secondary hover:bg-surface-secondary")}>
            Mis mesas
          </button>
          {canEdit && <Button variant="ghost" size="sm" className="hidden lg:inline-flex" onClick={() => setEditing(true)}>Editar plano</Button>}
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <div className="snap-x-chips gap-1.5 flex-1 min-w-0">
          {data.areas.map((a) => {
            const alert = alertsByArea.get(a.id) ?? 0;
            const on = a.id === areaId;
            return (
              <button key={a.id} onClick={() => setAreaId(a.id)} className={cn("h-10 px-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition-colors", on ? "bg-accent text-white" : "bg-surface border border-border text-text-secondary hover:bg-surface-secondary")}>
                {a.name}
                <span className={cn("text-xs tabular-nums", on ? "text-white/75" : "text-text-muted")}>{busyByArea.get(a.id) ?? 0}</span>
                {alert > 0 && <span className="w-2 h-2 rounded-full bg-error" aria-label={`${alert} con aviso`} />}
              </button>
            );
          })}
        </div>
        <button onClick={() => setShowLegend((v) => !v)} className="lg:hidden h-10 px-3 rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-secondary shrink-0">
          {showLegend ? "Ocultar colores" : "Colores"}
        </button>
      </div>

      <Legend className={cn(showLegend ? "flex" : "hidden", "lg:flex")} />

      {!area ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center text-sm text-text-secondary">
          Todavía no hay sectores. {canEdit ? "Entrá a Editar plano para armar el salón." : "Pedile al dueño que arme el plano."}
        </div>
      ) : view === "plan" ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="rounded-2xl border border-border bg-surface p-3 lg:p-4 overflow-x-auto">
            <div
              className="relative mx-auto"
              // El plano entra entero en la pantalla: el ancho sale del alto disponible.
              style={{ aspectRatio: `${area.width} / ${area.height}`, width: `min(100%, calc((100dvh - 15rem) * ${area.width / area.height}))`, minWidth: 520 }}
            >
              {tables.map((t) => (
                <PlanTable key={t.id} t={t} area={area} now={now} onClick={() => onTable(t)} onHover={(on) => setHover(on ? t.id : null)} />
              ))}
              {tables.length === 0 && <p className="absolute inset-0 flex items-center justify-center text-sm text-text-muted">{onlyMine ? "No tenés mesas en este sector." : "Sin mesas en este sector."}</p>}
              {hovered && hovered.areaId === area.id && <Preview t={hovered} area={area} now={now} />}
            </div>
          </div>
          <AttentionPanel tables={urgent} now={now} onOpen={onTable} />
        </div>
      ) : (
        <ListView tables={tables} now={now} onOpen={onTable} onlyMine={onlyMine} />
      )}

      {opening && <OpenTableSheet table={opening} onClose={() => setOpening(null)} />}
    </div>
  );
}

function Segmented<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div className="flex rounded-xl border border-border bg-surface p-0.5">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} className={cn("h-8 px-3 rounded-[10px] text-sm font-semibold", value === v ? "bg-accent-light text-accent" : "text-text-secondary hover:text-text-primary")}>
          {l}
        </button>
      ))}
    </div>
  );
}

function Legend({ className }: { className?: string }) {
  const states: TableState[] = ["FREE", "OCCUPIED", "READY", "LATE", "BILLING", "CALLING", "RESERVED"];
  return (
    <div className={cn("flex-wrap gap-x-4 gap-y-1.5 mb-3 text-xs text-text-secondary", className)}>
      {states.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-[4px] border-2" style={{ background: TABLE_STATE_STYLE[s].bg, borderColor: TABLE_STATE_STYLE[s].border }} />
          {TABLE_STATE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

function PlanTable({ t, area, now, onClick, onHover }: { t: SalonTable; area: { width: number; height: number }; now: number | null; onClick: () => void; onHover: (on: boolean) => void }) {
  const elapsed = useElapsed(t.order?.openedAt, now);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className="absolute fs-press focus-visible:outline-none hover:z-10"
      style={{
        left: `${(t.x / area.width) * 100}%`,
        top: `${(t.y / area.height) * 100}%`,
        width: `${(t.w / area.width) * 100}%`,
        height: `${(t.h / area.height) * 100}%`,
        transform: t.rotation ? `rotate(${t.rotation}deg)` : undefined,
      }}
      aria-label={`Mesa ${t.name}, ${TABLE_STATE_LABEL[t.state]}`}
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
        reservation={t.reservation ? formatTime(t.reservation.dateTime) : null}
        compact={t.w < 70 || t.h < 70}
      />
    </button>
  );
}

/** Adelanto al pasar el mouse: lo que se pregunta antes de entrar a la mesa. */
function Preview({ t, area, now }: { t: SalonTable; area: { width: number; height: number }; now: number | null }) {
  const elapsed = useElapsed(t.order?.openedAt, now);
  const right = t.x / area.width > 0.6;
  const st = TABLE_STATE_STYLE[t.state];
  return (
    <div
      className="absolute z-20 w-56 rounded-2xl border border-border bg-surface shadow-xl p-3 pointer-events-none fs-fade-in"
      style={{
        top: `${(t.y / area.height) * 100}%`,
        ...(right ? { right: `${100 - (t.x / area.width) * 100 + 1}%` } : { left: `${((t.x + t.w) / area.width) * 100 + 1}%` }),
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-base font-bold text-text-primary">Mesa {t.name}</p>
        <span className="text-xs font-semibold" style={{ color: st.text }}>{TABLE_STATE_LABEL[t.state]}</span>
      </div>
      {t.order ? (
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-text-muted">Mozo</dt><dd className="text-right text-text-primary truncate">{t.order.waiterName ?? "—"}</dd>
          <dt className="text-text-muted">Personas</dt><dd className="text-right tabular-nums">{t.order.guests}</dd>
          <dt className="text-text-muted">Hace</dt><dd className="text-right tabular-nums">{elapsed}</dd>
          {t.order.readyItems > 0 && <><dt className="text-success-strong">Listos</dt><dd className="text-right tabular-nums text-success-strong font-semibold">{t.order.readyItems}</dd></>}
          {t.order.draftItems > 0 && <><dt className="text-warning-strong">Sin marchar</dt><dd className="text-right tabular-nums text-warning-strong font-semibold">{t.order.draftItems}</dd></>}
          {t.order.heldItems > 0 && <><dt className="text-text-muted">En espera</dt><dd className="text-right tabular-nums">{t.order.heldItems}</dd></>}
          <dt className="text-text-muted pt-1 border-t border-border">Total</dt><dd className="text-right font-bold tabular-nums pt-1 border-t border-border">{formatCurrency(t.order.total)}</dd>
        </dl>
      ) : t.reservation ? (
        <p className="mt-2 text-sm text-text-secondary">Reserva {formatTime(t.reservation.dateTime)} · {t.reservation.name} ({t.reservation.partySize})</p>
      ) : (
        <p className="mt-2 text-sm text-text-secondary">{t.seats} lugares. Tocá para abrirla.</p>
      )}
    </div>
  );
}

/** La fila de lo que necesita a alguien ahora, ordenada por urgencia. */
function AttentionPanel({ tables, now, onOpen }: { tables: SalonTable[]; now: number | null; onOpen: (t: SalonTable) => void }) {
  return (
    <aside className="hidden xl:block rounded-2xl border border-border bg-surface overflow-hidden self-start">
      <p className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Necesitan atención</p>
      {tables.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-text-secondary">Nada pendiente. Todo el salón está al día.</p>
      ) : (
        tables.map((t) => <AttentionRow key={t.id} t={t} now={now} onOpen={onOpen} />)
      )}
    </aside>
  );
}

function AttentionRow({ t, now, onOpen }: { t: SalonTable; now: number | null; onOpen: (t: SalonTable) => void }) {
  const elapsed = useElapsed(t.order?.openedAt, now);
  const st = TABLE_STATE_STYLE[t.state];
  const what = t.state === "READY" ? `${t.order?.readyItems ?? 0} para llevar` : t.state === "LATE" ? "La cocina viene demorada" : t.state === "BILLING" ? "Quiere pagar" : "Llama al mozo";
  return (
    <button onClick={() => onOpen(t)} className="w-full text-left flex items-center gap-3 border-t border-border px-4 py-2.5 hover:bg-surface-secondary">
      <span className="w-1 self-stretch rounded-full" style={{ background: st.dot }} />
      <span className="text-lg font-bold tabular-nums w-10" style={{ color: st.text }}>{t.name}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-text-primary">{what}</span>
        <span className="block text-xs text-text-muted truncate">{t.order?.waiterName ?? "Sin mozo"}{elapsed ? ` · ${elapsed}` : ""}</span>
      </span>
    </button>
  );
}

function ListView({ tables, now, onOpen, onlyMine }: { tables: SalonTable[]; now: number | null; onOpen: (t: SalonTable) => void; onlyMine: boolean }) {
  const taken = tables.filter((t) => t.order || t.state === "RESERVED").sort((a, b) => PRIORITY.indexOf(a.state) - PRIORITY.indexOf(b.state) || (a.name.localeCompare(b.name, "es", { numeric: true })));
  const free = tables.filter((t) => !t.order && t.state === "FREE");
  if (tables.length === 0) return <p className="text-sm text-text-muted py-8 text-center">{onlyMine ? "No tenés mesas en este sector." : "Sin mesas en este sector."}</p>;
  return (
    <div className="space-y-4">
      {taken.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 gap-2.5">
          {taken.map((t) => <ListTable key={t.id} t={t} now={now} onClick={() => onOpen(t)} />)}
        </div>
      )}
      {free.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-2">Libres · {free.length}</p>
          <div className="grid grid-cols-5 sm:grid-cols-8 lg:grid-cols-12 gap-2">
            {free.map((t) => (
              <button key={t.id} onClick={() => onOpen(t)} className="fs-press h-12 rounded-xl border border-border bg-surface text-base font-bold tabular-nums text-text-secondary hover:border-accent hover:text-accent">
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ListTable({ t, now, onClick }: { t: SalonTable; now: number | null; onClick: () => void }) {
  const elapsed = useElapsed(t.order?.openedAt, now);
  const st = TABLE_STATE_STYLE[t.state];
  const urgent = ["CALLING", "READY", "LATE"].includes(t.state);
  return (
    <button
      onClick={onClick}
      className={cn("fs-press text-left rounded-2xl border-2 p-3 min-h-[6.5rem] flex flex-col", urgent && "rd-pulse")}
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
            <span className="truncate">{t.order.guests}p · {t.order.waiterName?.split(" ")[0] ?? "—"}</span>
            <span className="font-semibold tabular-nums text-text-primary">{formatCurrency(t.order.total)}</span>
          </>
        ) : t.reservation ? (
          <span className="truncate">{formatTime(t.reservation.dateTime)} · {t.reservation.name} ({t.reservation.partySize})</span>
        ) : null}
      </div>
    </button>
  );
}

function OpenTableSheet({ table, onClose }: { table: SalonTable; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [guests, setGuests] = useState(table.reservation?.partySize ?? Math.min(table.seats, 2));
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
      description={table.reservation ? `Reservada a las ${formatTime(table.reservation.dateTime)} para ${table.reservation.name}` : `${table.seats} lugares`}
      maxWidth="max-w-sm"
      footer={<Button fullWidth size="lg" loading={busy} onClick={open}>Abrir mesa para {guests}</Button>}
    >
      <p className="text-sm font-medium text-text-primary mb-3">¿Cuántas personas?</p>
      <div className="flex items-center justify-center gap-5">
        <button onClick={() => setGuests((g) => Math.max(1, g - 1))} className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center hover:bg-surface-secondary" aria-label="Una menos">
          <Minus className="w-6 h-6" />
        </button>
        <span className="text-5xl font-bold tabular-nums w-20 text-center text-text-primary">{guests}</span>
        <button onClick={() => setGuests((g) => Math.min(99, g + 1))} className="w-14 h-14 rounded-2xl border border-border bg-surface flex items-center justify-center hover:bg-surface-secondary" aria-label="Una más">
          <Plus className="w-6 h-6" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-5">
        {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
          <button key={n} onClick={() => setGuests(n)} className={cn("h-11 rounded-xl border text-sm font-semibold tabular-nums", guests === n ? "bg-accent text-white border-accent" : "border-border text-text-secondary hover:bg-surface-secondary")}>
            {n}
          </button>
        ))}
      </div>
      {table.reservation && <Link href="/reservas" className={buttonClasses({ variant: "ghost", size: "sm" }, "mt-3 w-full")}>Ver la reserva</Link>}
    </Sheet>
  );
}
