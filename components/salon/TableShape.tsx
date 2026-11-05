"use client";

import { Hand, Receipt, ChefHat, Clock, Umbrella, Armchair } from "lucide-react";
import { TABLE_STATE_LABEL, TABLE_STATE_STYLE, type TableState } from "@/lib/salon/state";
import { initials, solidColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

export function useElapsed(iso: string | null | undefined, now: number | null): string | null {
  if (!iso || now === null) return null;
  const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export type TableShapeProps = {
  name: string;
  shape: string;
  seats: number;
  state: TableState;
  guests?: number | null;
  elapsed?: string | null;
  waiter?: { name: string; color: string | null } | null;
  readyItems?: number;
  draftItems?: number;
  reservation?: string | null;
  selected?: boolean;
  compact?: boolean;
};

/**
 * Una mesa dibujada en el plano. La forma sigue al mueble (cuadrada, redonda,
 * banqueta, sombrilla, reposera) y el color al estado. Lo urgente late.
 */
export function TableShape(p: TableShapeProps) {
  const style = TABLE_STATE_STYLE[p.state];
  const round = p.shape === "ROUND" || p.shape === "UMBRELLA" || p.shape === "BAR";
  const urgent = p.state === "CALLING" || p.state === "LATE" || p.state === "READY";
  const Icon = p.state === "CALLING" ? Hand : p.state === "BILLING" ? Receipt : p.state === "READY" ? ChefHat : p.state === "LATE" ? Clock : null;
  return (
    <div
      className={cn(
        "relative w-full h-full flex flex-col items-center justify-center border-2 select-none transition-colors",
        round ? "rounded-full" : p.shape === "LOUNGER" ? "rounded-xl" : "rounded-2xl",
        urgent && "rd-pulse",
        p.selected && "ring-4 ring-accent/30",
      )}
      style={{ background: style.bg, borderColor: style.border, color: style.text, ["--pulse-color" as string]: style.dot }}
      title={`Mesa ${p.name} · ${TABLE_STATE_LABEL[p.state]}`}
    >
      {p.shape === "UMBRELLA" && p.state === "FREE" && <Umbrella className="absolute top-1.5 w-3.5 h-3.5 opacity-50" />}
      {p.shape === "LOUNGER" && p.state === "FREE" && <Armchair className="absolute left-1.5 w-3.5 h-3.5 opacity-50" />}
      <span className={cn("font-bold leading-none tabular-nums", p.compact ? "text-sm" : "text-lg")}>{p.name}</span>
      {p.state !== "FREE" && p.state !== "RESERVED" && !p.compact && (
        <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold leading-none tabular-nums">
          {Icon && <Icon className="w-3 h-3" />}
          {p.guests ? `${p.guests}p` : null}
          {p.elapsed ? <span className="opacity-80">· {p.elapsed}</span> : null}
        </span>
      )}
      {p.state === "RESERVED" && p.reservation && !p.compact && <span className="mt-1 text-[10px] font-semibold leading-none truncate max-w-[90%]">{p.reservation}</span>}
      {p.waiter && (
        <span
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full border-2 border-surface text-[9px] font-bold text-white flex items-center justify-center"
          style={{ background: solidColor(p.waiter.color) }}
          title={p.waiter.name}
        >
          {initials(p.waiter.name)}
        </span>
      )}
      {(p.readyItems ?? 0) > 0 && (
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 h-4 rounded-full bg-success text-white text-[10px] font-bold flex items-center tabular-nums">
          {p.readyItems} listo{p.readyItems === 1 ? "" : "s"}
        </span>
      )}
      {(p.readyItems ?? 0) === 0 && (p.draftItems ?? 0) > 0 && (
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-1.5 h-4 rounded-full bg-warning text-white text-[10px] font-bold flex items-center whitespace-nowrap">
          sin marchar
        </span>
      )}
    </div>
  );
}
