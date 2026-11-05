"use client";

import { useEffect, useRef } from "react";
import { LogoMark } from "@/components/brand/Logo";
import { useLiveRefresh } from "@/lib/realtime/client";
import { beep } from "@/components/layout/NotificationsCenter";

type P = { number: number; name: string | null };

export function PickupDisplay({ orgName, preparing, ready }: { orgName: string; preparing: P[]; ready: P[] }) {
  useLiveRefresh(["order.changed", "kitchen.changed"], 15_000);
  const seen = useRef<Set<number> | null>(null);
  useEffect(() => {
    if (seen.current) {
      if (ready.some((r) => !seen.current!.has(r.number))) beep(2);
    }
    seen.current = new Set(ready.map((r) => r.number));
  }, [ready]);
  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <header className="flex items-center gap-3 px-6 h-16 bg-accent text-white">
        <LogoMark className="w-8 h-8" />
        <p className="text-xl lg:text-2xl font-bold tracking-tight">{orgName}</p>
      </header>
      <div className="flex-1 grid md:grid-cols-2">
        <section className="p-6 border-r border-border">
          <h1 className="text-2xl lg:text-4xl font-bold text-text-secondary mb-6">En preparación</h1>
          {preparing.length === 0 && <p className="text-xl text-text-muted">No hay pedidos en preparación.</p>}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {preparing.map((p) => (
              <div key={p.number} className="rounded-2xl border border-border bg-surface p-4 text-center">
                <p className="text-5xl lg:text-7xl font-bold tabular-nums text-text-primary">{p.number}</p>
                {p.name && <p className="text-lg text-text-secondary truncate">{p.name}</p>}
              </div>
            ))}
          </div>
        </section>
        <section className="p-6 bg-success-subtle">
          <h1 className="text-2xl lg:text-4xl font-bold text-success-strong mb-6">Listos para retirar</h1>
          {ready.length === 0 && <p className="text-xl text-success-strong/70">Cuando tu pedido esté listo, tu número aparece acá.</p>}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {ready.map((p) => (
              <div key={p.number} className="rounded-2xl border-2 border-success bg-surface p-4 text-center fs-bump">
                <p className="text-6xl lg:text-8xl font-bold tabular-nums text-success-strong">{p.number}</p>
                {p.name && <p className="text-xl font-semibold text-text-primary truncate">{p.name}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
