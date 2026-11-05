"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Flame, Maximize, Printer, Volume2, VolumeX } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { LiveIndicator } from "@/components/layout/LiveIndicator";
import { Sheet, Switch } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { useLiveRefresh, useRealtime } from "@/lib/realtime/client";
import { api } from "@/lib/client/api";
import type { KdsData, KdsTicket } from "@/lib/kitchen/queries";
import { ORDER_TYPE_LABEL, courseLabel } from "@/lib/orders/labels";
import { beep } from "@/components/layout/NotificationsCenter";
import { solidColor } from "@/lib/colors";
import { formatQty, formatTime, cn } from "@/lib/utils";

type Product = { id: string; name: string; available: boolean; category: string };

function useClock() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * La pantalla de cocina. Cada comanda es una tarjeta con su reloj: verde,
 * ámbar a mitad del tiempo, roja cuando se pasa. Un toque en un plato lo marca
 * listo; "Listo" despacha la comanda y avisa al mozo en su teléfono.
 */
export function KitchenDisplay({ data, stationId, deviceName, userName, products }: { data: KdsData; stationId: string | null; deviceName: string | null; userName: string | null; products: Product[] }) {
  useLiveRefresh(["kitchen.changed", "order.changed", "menu.changed"], 15_000);
  const router = useRouter();
  const toast = useToast();
  const now = useClock();
  const [sound, setSound] = useState(true);
  const [showReady, setShowReady] = useState(false);
  const [showAllDay, setShowAllDay] = useState(false);
  const [show86, setShow86] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const known = useRef<Set<string>>(new Set(data.tickets.map((t) => t.id)));

  // Comanda nueva: pitido (y se marca un ratito). La primera carga no suena.
  useEffect(() => {
    const fresh = data.tickets.filter((t) => !known.current.has(t.id));
    if (fresh.length && sound) beep(3);
    for (const t of data.tickets) known.current.add(t.id);
  }, [data.tickets, sound]);

  useRealtime((ev) => {
    if (ev.type === "kitchen.changed") router.refresh();
  });

  const active = data.tickets.filter((t) => t.status !== "READY");
  const ready = data.tickets.filter((t) => t.status === "READY");
  const list = showReady ? ready : active;

  async function act(t: KdsTicket, action: string) {
    setBusy(t.id + action);
    try {
      await api(`/api/kitchen/tickets/${t.id}`, { body: { action } });
      if (action === "reprint") toast.success("Se mandó a imprimir");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function toggleItem(id: string) {
    setBusy(id);
    try {
      await api(`/api/kitchen/items/${id}`, { body: {} });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function set86(p: Product, available: boolean) {
    try {
      await api(`/api/products/${p.id}/availability`, { body: { available } });
      toast.success(available ? `Volvió: ${p.name}` : `Sin stock: ${p.name}`, available ? undefined : "Ya no se puede pedir desde ninguna terminal.");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const stationName = stationId ? data.stations.find((s) => s.id === stationId)?.name ?? "Estación" : "Todas las estaciones";
  const late = now ? active.filter((t) => now - new Date(t.createdAt).getTime() > data.lateMinutes * 60_000).length : 0;
  const unavailable = products.filter((p) => !p.available).length;

  const productsByCat = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of products) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [products]);

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        {/* Fila 1: dónde estoy, la hora y los controles del equipo. */}
        <div className="flex items-center gap-2 px-3 pt-2">
          {userName ? (
            <Link href="/" className="tap-44 flex items-center justify-center rounded-xl text-text-secondary hover:bg-surface-secondary" aria-label="Volver"><ArrowLeft className="w-5 h-5" /></Link>
          ) : (
            <LogoMark className="w-7 h-7 text-accent ml-1" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-tight text-text-primary leading-tight truncate">{stationName}</p>
            <p className="text-xs text-text-muted leading-tight truncate">{deviceName ?? userName}</p>
          </div>
          <span className="text-lg font-bold tabular-nums text-text-primary">{now ? formatTime(new Date(now)) : ""}</span>
          <button onClick={() => setSound((s) => !s)} className="tap-44 flex items-center justify-center rounded-xl text-text-secondary hover:bg-surface-secondary" aria-label={sound ? "Silenciar" : "Activar sonido"}>
            {sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <button onClick={() => document.documentElement.requestFullscreen?.().catch(() => {})} className="tap-44 hidden sm:flex items-center justify-center rounded-xl text-text-secondary hover:bg-surface-secondary" aria-label="Pantalla completa"><Maximize className="w-5 h-5" /></button>
          <LiveIndicator />
        </div>
        {/* Fila 2: estaciones y lo que hay en curso; se desliza si no entra. */}
        <div className="snap-x-chips gap-1.5 px-3 py-2">
          <StationTab href="/cocina?estacion=todas" active={!stationId} label="Todas" />
          {data.stations.map((s) => (
            <StationTab key={s.id} href={`/cocina?estacion=${s.id}`} active={stationId === s.id} label={s.name} color={s.color} />
          ))}
          <span className="w-px h-6 bg-border self-center mx-1" />
          <Counter label="En curso" value={active.length} />
          {late > 0 && <Counter label="Demoradas" value={late} tone="error" />}
          <button onClick={() => setShowReady((v) => !v)} className={cn("h-10 px-3 rounded-xl border text-sm font-semibold whitespace-nowrap", showReady ? "bg-success text-white border-success" : "border-border text-text-secondary hover:bg-surface-secondary")}>
            {showReady ? "Ver en curso" : `Listas (${ready.length})`}
          </button>
          <button onClick={() => setShowAllDay(true)} className="h-10 px-3 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-secondary whitespace-nowrap">Totales</button>
          <button onClick={() => setShow86(true)} className="h-10 px-3 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-secondary whitespace-nowrap">
            Sin stock{unavailable ? ` (${unavailable})` : ""}
          </button>
        </div>
      </header>

      <main className="flex-1 p-3">
        {list.length === 0 ? (
          <div className="h-[60dvh] flex flex-col items-center justify-center text-center">
            <p className="text-lg font-semibold text-text-primary">{showReady ? "No hay comandas listas recientes" : "Todo al día"}</p>
            <p className="text-sm text-text-secondary mt-1">{showReady ? "Acá quedan 30 minutos las que despachaste, por si hay que recuperarlas." : "Las comandas nuevas aparecen solas, con aviso sonoro."}</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 2xl:columns-5 gap-3 [column-fill:_balance]">
            {list.map((t) => (
              <TicketCard key={t.id} t={t} now={now} lateMinutes={data.lateMinutes} busy={busy} onAct={act} onItem={toggleItem} showStation={!stationId} />
            ))}
          </div>
        )}
      </main>

      <Sheet open={showAllDay} onClose={() => setShowAllDay(false)} title="Totales en curso" description="Cuánto hay que sacar de cada plato, sumando todas las comandas abiertas." maxWidth="max-w-md">
        {data.allDay.length === 0 ? (
          <p className="text-sm text-text-secondary">Nada pendiente.</p>
        ) : (
          <div className="divide-y divide-border -mx-1">
            {data.allDay.map((r) => (
              <div key={r.name} className="flex items-center justify-between px-1 py-2.5">
                <span className="text-base text-text-primary">{r.name}</span>
                <span className="text-2xl font-bold tabular-nums text-text-primary">{formatQty(r.quantity)}</span>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={show86} onClose={() => setShow86(false)} title="Platos sin stock" description="Apagá lo que se terminó: deja de ofrecerse en todas las terminales y en la carta QR." maxWidth="max-w-lg">
        <div className="space-y-4">
          {productsByCat.map(([cat, ps]) => (
            <div key={cat}>
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted mb-1">{cat}</p>
              <div className="divide-y divide-border">
                {ps.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-3 py-2">
                    <span className={cn("text-sm", p.available ? "text-text-primary" : "text-error font-semibold")}>{p.name}</span>
                    <Switch checked={p.available} onChange={(v) => set86(p, v)} label={`${p.name} disponible`} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function StationTab({ href, active, label, color }: { href: string; active: boolean; label: string; color?: string }) {
  return (
    <Link href={href} className={cn("h-10 px-3 rounded-xl border text-sm font-semibold flex items-center gap-2 whitespace-nowrap", active ? "bg-accent text-white border-accent" : "border-border text-text-secondary hover:bg-surface-secondary")}>
      {color && <span className="w-2 h-2 rounded-full" style={{ background: active ? "white" : solidColor(color) }} />}
      {label}
    </Link>
  );
}

function Counter({ label, value, tone }: { label: string; value: number; tone?: "error" }) {
  return (
    <span className={cn("h-10 px-3 rounded-xl flex items-center gap-1.5 text-sm whitespace-nowrap", tone === "error" ? "bg-error-light text-error-strong" : "bg-surface-secondary text-text-secondary")}>
      {label} <b className="tabular-nums">{value}</b>
    </span>
  );
}

function TicketCard({ t, now, lateMinutes, busy, onAct, onItem, showStation }: {
  t: KdsTicket; now: number | null; lateMinutes: number; busy: string | null; onAct: (t: KdsTicket, a: string) => void; onItem: (id: string) => void; showStation: boolean;
}) {
  const elapsed = now ? now - new Date(t.createdAt).getTime() : 0;
  const ratio = elapsed / (lateMinutes * 60_000);
  const ready = t.status === "READY";
  const tone = ready ? "success" : ratio >= 1 ? "error" : ratio >= 0.6 ? "warning" : "accent";
  const headBg = { success: "var(--success)", error: "var(--error)", warning: "var(--warning)", accent: "var(--accent)" }[tone];
  const courses = [...new Set(t.items.map((i) => i.course))];
  return (
    <div className={cn("mb-3 break-inside-avoid rounded-2xl border-2 bg-surface overflow-hidden fs-fade-in", t.priority && !ready && "rd-pulse")} style={{ borderColor: headBg, ["--pulse-color" as string]: headBg }}>
      <div className="px-3 py-2 text-white flex items-start justify-between gap-2" style={{ background: headBg }}>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight truncate">{t.label}</p>
          <p className="text-xs opacity-90 leading-tight">
            {[t.orderType === "DINE_IN" || t.orderType === "QR" ? null : ORDER_TYPE_LABEL[t.orderType], t.waiter, t.orderType === "DINE_IN" ? `${t.guests} personas` : null, showStation ? t.stationName : null].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xl font-bold tabular-nums leading-tight">{ready && t.readyAt ? formatTime(t.readyAt) : mmss(elapsed)}</p>
          {t.priority && <p className="text-[11px] font-bold uppercase tracking-wide">Prioridad</p>}
        </div>
      </div>
      {t.notes && <p className="px-3 py-1.5 text-sm font-semibold bg-warning-light text-warning-strong">{t.notes}</p>}
      <div className="divide-y divide-border">
        {courses.map((c) => (
          <div key={c}>
            {courses.length > 1 && <p className="px-3 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">{courseLabel(c)}</p>}
            {t.items.filter((i) => i.course === c).map((i) => {
              const voided = i.status === "VOID";
              const done = i.status === "READY" || i.status === "SERVED";
              return (
                <button
                  key={i.id}
                  disabled={voided || busy === i.id || i.status === "SERVED"}
                  onClick={() => onItem(i.id)}
                  className={cn("w-full text-left flex items-start gap-2.5 px-3 py-2 transition-colors", done && "bg-success-subtle", voided && "bg-error-subtle", !voided && !done && "hover:bg-surface-secondary")}
                >
                  <span className={cn("text-xl font-bold tabular-nums leading-tight w-8 shrink-0", voided ? "text-error line-through" : done ? "text-success-strong" : "text-text-primary")}>{formatQty(i.quantity)}</span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-lg font-semibold leading-tight", voided ? "text-error line-through" : done ? "text-success-strong line-through" : "text-text-primary")}>
                      {i.name}{i.seat ? <span className="text-sm font-semibold text-violet-strong"> P{i.seat}</span> : null}
                    </span>
                    {i.modifiers.length > 0 && <span className="block text-sm font-medium text-text-secondary leading-snug">{i.modifiers.join(" · ")}</span>}
                    {i.notes && <span className="block text-sm font-bold text-warning-strong leading-snug">{i.notes}</span>}
                    {voided && <span className="block text-xs font-bold uppercase text-error">Anulado</span>}
                  </span>
                  {done && <Check className="w-5 h-5 text-success-strong shrink-0 mt-0.5" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {t.held.length > 0 && (
        <div className="px-3 py-2 bg-surface-secondary text-xs text-text-secondary">
          <span className="font-semibold">Después siguen (esperar aviso):</span> {t.held.map((h) => `${formatQty(h.quantity)} ${h.name}`).join(", ")}
        </div>
      )}
      <div className="flex gap-1.5 p-2 border-t border-border">
        {(t.status === "NEW" || t.status === "PREPARING") && (
          <button onClick={() => onAct(t, "ready")} disabled={!!busy} className="flex-1 h-12 rounded-xl bg-success text-white text-base font-semibold hover:brightness-95 disabled:opacity-60">Listo</button>
        )}
        {ready && (
          <>
            <button onClick={() => onAct(t, "done")} disabled={!!busy} className="flex-1 h-12 rounded-xl bg-success text-white text-base font-semibold hover:brightness-95 disabled:opacity-60">Retirado</button>
            <button onClick={() => onAct(t, "recall")} disabled={!!busy} className="h-12 px-3 rounded-xl border border-border text-sm font-semibold text-text-secondary hover:bg-surface-secondary flex items-center gap-1.5">Volver a cocina</button>
          </>
        )}
        {!ready && (
          <button onClick={() => onAct(t, "priority")} disabled={!!busy} className={cn("w-12 h-12 rounded-xl border flex items-center justify-center", t.priority ? "bg-warning-light border-warning text-warning-strong" : "border-border text-text-secondary hover:bg-surface-secondary")} aria-label="Prioridad">
            <Flame className="w-5 h-5" />
          </button>
        )}
        <button onClick={() => onAct(t, "reprint")} disabled={!!busy} className="w-12 h-12 rounded-xl border border-border text-text-secondary hover:bg-surface-secondary flex items-center justify-center" aria-label="Reimprimir"><Printer className="w-5 h-5" /></button>
      </div>
    </div>
  );
}

