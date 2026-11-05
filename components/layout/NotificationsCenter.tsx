"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, Check, ChefHat, Hand, Printer, Receipt, RotateCcw, ShoppingBag } from "lucide-react";
import { useRealtime } from "@/lib/realtime/client";
import { api } from "@/lib/client/api";
import { useToast } from "@/components/ui/Toast";
import { formatTime, cn } from "@/lib/utils";
import { REQUEST_KIND_LABEL } from "@/lib/orders/labels";

type Notif = {
  requests: { id: string; kind: string; tableName: string; detail: string | null; createdAt: string; status: string; orderId: string | null }[];
  ready: { orderId: string; label: string; count: number; mine: boolean; readyAt: string }[];
  printFailures: { id: string; title: string; lastError: string | null; createdAt: string }[];
};

/** Pitido corto, sin archivos de audio: avisa sin que haya que mirar la pantalla. */
export function beep(times = 2) {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    for (let i = 0; i < times; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + i * 0.22);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + i * 0.22 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + i * 0.22 + 0.18);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + i * 0.22);
      o.stop(ctx.currentTime + i * 0.22 + 0.2);
    }
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* sin audio */
  }
}

/**
 * Campana: lo que necesita a alguien AHORA. Una mesa que llama, una que pide
 * la cuenta, un plato listo para llevar, una comandera que no imprimió.
 */
export function NotificationsCenter({ userId }: { userId: string }) {
  const [data, setData] = useState<Notif>({ requests: [], ready: [], printFailures: [] });
  const [open, setOpen] = useState(false);
  const toast = useToast();
  const ref = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    api<Notif>("/api/notifications").then(setData).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 45_000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  useRealtime((ev) => {
    if (ev.type === "request.new") {
      beep(3);
      toast.info(`${ev.tableName}: ${REQUEST_KIND_LABEL[ev.kind] ?? "Llamado"}`);
      load();
    } else if (ev.type === "ticket.ready") {
      if (!ev.waiterId || ev.waiterId === userId) {
        beep(2);
        toast.success(`Listo para llevar: ${ev.label}`, ev.stationName);
      }
      load();
    } else if (ev.type === "print.failed") {
      toast.error("No se pudo imprimir", `${ev.title}. ${ev.error}`);
      load();
    } else if (["request.changed", "order.changed", "kitchen.changed", "resync"].includes(ev.type)) {
      load();
    }
  });

  const count = data.requests.length + data.ready.filter((r) => r.mine).length + data.printFailures.length;

  async function resolve(id: string, status: "ACK" | "DONE") {
    await api(`/api/requests/${id}`, { body: { status } }).catch((e: Error) => toast.error(e.message));
    load();
  }
  async function retry(id: string) {
    await api(`/api/print/${id}/retry`, { body: {} }).then(() => toast.success("Se reenvió a la impresora")).catch((e: Error) => toast.error(e.message));
    load();
  }

  const Icon = count > 0 ? BellRing : Bell;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn("tap-44 relative flex items-center justify-center rounded-xl hover:bg-surface-secondary", count > 0 ? "text-accent" : "text-text-secondary")}
        aria-label="Avisos"
      >
        <Icon className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-4.5 h-4.5 px-1 rounded-full bg-error text-white text-[10px] font-bold flex items-center justify-center tabular-nums">{count}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] max-h-[70dvh] overflow-y-auto scroll-contain rounded-2xl border border-border bg-surface shadow-xl fs-fade-scale">
          <p className="px-4 pt-3 pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">Avisos</p>
          {count === 0 && data.ready.length === 0 && <p className="px-4 pb-4 text-sm text-text-secondary">Nada pendiente. Todo en orden.</p>}
          {data.requests.map((r) => (
            <div key={r.id} className="flex items-start gap-3 border-t border-border px-4 py-3">
              <span className={cn("w-8 h-8 rounded-xl flex items-center justify-center shrink-0", r.kind === "BILL" ? "bg-warning-light text-warning-strong" : r.kind === "ORDER" ? "bg-info-light text-info-strong" : "bg-error-light text-error-strong")}>
                {r.kind === "BILL" ? <Receipt className="w-4 h-4" /> : r.kind === "ORDER" ? <ShoppingBag className="w-4 h-4" /> : <Hand className="w-4 h-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">Mesa {r.tableName} · {REQUEST_KIND_LABEL[r.kind]}</p>
                <p className="text-xs text-text-muted">{formatTime(r.createdAt)}{r.detail ? ` · ${r.detail}` : ""}{r.status === "ACK" ? " · Tomado" : ""}</p>
                <div className="flex gap-2 mt-2">
                  {r.orderId && (
                    <Link href={`/pedidos/${r.orderId}`} onClick={() => setOpen(false)} className="text-xs font-semibold text-accent hover:underline">Ver pedido</Link>
                  )}
                  {r.status === "OPEN" && <button onClick={() => resolve(r.id, "ACK")} className="text-xs font-semibold text-accent hover:underline">Voy yo</button>}
                  <button onClick={() => resolve(r.id, "DONE")} className="text-xs font-semibold text-text-secondary hover:underline">Resuelto</button>
                </div>
              </div>
            </div>
          ))}
          {data.ready.map((r) => (
            <Link key={r.orderId} href={`/pedidos/${r.orderId}`} onClick={() => setOpen(false)} className="flex items-start gap-3 border-t border-border px-4 py-3 hover:bg-surface-secondary">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-success-light text-success-strong">
                <ChefHat className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">Listo para llevar · {r.label}</p>
                <p className="text-xs text-text-muted">{r.count} {r.count === 1 ? "plato" : "platos"} · desde {formatTime(r.readyAt)}{r.mine ? " · tu mesa" : ""}</p>
              </div>
              <Check className="w-4 h-4 text-text-muted mt-1" />
            </Link>
          ))}
          {data.printFailures.map((p) => (
            <div key={p.id} className="flex items-start gap-3 border-t border-border px-4 py-3">
              <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 bg-error-light text-error-strong">
                <Printer className="w-4 h-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text-primary">No imprimió: {p.title}</p>
                <p className="text-xs text-text-muted">{p.lastError ?? "Error de impresora"} · se sigue reintentando</p>
                <button onClick={() => retry(p.id)} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
                  <RotateCcw className="w-3.5 h-3.5" /> Reintentar ahora
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
