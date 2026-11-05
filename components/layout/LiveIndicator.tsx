"use client";

import { useRealtimeStatus } from "@/lib/realtime/client";
import { cn } from "@/lib/utils";

/**
 * "En vivo" / "Reconectando": que el mozo sepa si lo que ve está al día. Si se
 * cae el wifi, se nota acá antes de que alguien pregunte por una comanda.
 */
export function LiveIndicator({ className }: { className?: string }) {
  const live = useRealtimeStatus();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-xl text-xs font-semibold",
        live ? "text-success-strong bg-success-subtle" : "text-warning-strong bg-warning-light",
        className,
      )}
      title={live ? "Conectado: todo se actualiza solo" : "Sin conexión en vivo: reconectando"}
    >
      <span className={cn("w-2 h-2 rounded-full", live ? "bg-success" : "bg-warning animate-pulse")} />
      <span className="hidden sm:inline">{live ? "En vivo" : "Reconectando"}</span>
    </span>
  );
}
