"use client";

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
 * Una mesa dibujada en el plano. La forma sigue al mueble y el color al
 * estado; lo urgente late. Adentro, solo lo que se lee de lejos: el número
 * de mesa, cuántos son y hace cuánto llegaron.
 */
export function TableShape(p: TableShapeProps) {
  const style = TABLE_STATE_STYLE[p.state];
  const round = p.shape === "ROUND" || p.shape === "UMBRELLA" || p.shape === "BAR";
  const urgent = p.state === "CALLING" || p.state === "LATE" || p.state === "READY";
  const busy = p.state !== "FREE" && p.state !== "RESERVED";
  return (
    <div
      className={cn(
        "relative w-full h-full flex flex-col items-center justify-center border-2 select-none transition-[box-shadow,transform] [container-type:size]",
        round ? "rounded-full" : p.shape === "LOUNGER" ? "rounded-xl" : "rounded-2xl",
        p.shape === "UMBRELLA" && !busy && "border-dashed",
        urgent && "rd-pulse",
        p.selected && "ring-4 ring-accent/30",
      )}
      style={{ background: style.bg, borderColor: style.border, color: style.text, ["--pulse-color" as string]: style.dot }}
      title={`Mesa ${p.name} · ${TABLE_STATE_LABEL[p.state]}`}
    >
      <span className={cn("font-bold leading-none tabular-nums", p.compact ? "text-sm" : "text-[clamp(14px,28cqmin,26px)]")}>{p.name}</span>
      {busy && !p.compact && (
        <span className="mt-1 text-[clamp(10px,13cqmin,13px)] font-semibold leading-none tabular-nums opacity-90">
          {p.guests ? `${p.guests}p` : ""}{p.elapsed ? ` · ${p.elapsed}` : ""}
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
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 h-4 rounded-full bg-success text-white text-[10px] font-bold flex items-center tabular-nums whitespace-nowrap">
          {p.readyItems} listo{p.readyItems === 1 ? "" : "s"}
        </span>
      )}
      {(p.readyItems ?? 0) === 0 && (p.draftItems ?? 0) > 0 && (
        <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-1.5 h-4 rounded-full bg-warning text-white text-[10px] font-bold flex items-center whitespace-nowrap">
          sin marchar
        </span>
      )}
    </div>
  );
}
