"use client";

import { useMemo, useState } from "react";
import { Ban, Search, SlidersHorizontal, X } from "lucide-react";
import type { MenuData, MenuProduct } from "@/lib/orders/queries";
import { softColor, solidColor } from "@/lib/colors";
import { formatCurrency, cn } from "@/lib/utils";

/**
 * La carta para cargar: categorías arriba, buscador, y botones grandes. Un
 * toque agrega; si el plato tiene opciones (punto, guarnición) se abren.
 */
export function MenuPanel({ menu, onPick, busyId, disabled }: { menu: MenuData; onPick: (p: MenuProduct) => void; busyId: string | null; disabled?: boolean }) {
  const [cat, setCat] = useState<string | null>(menu.categories[0]?.id ?? null);
  const [q, setQ] = useState("");

  const products = useMemo(() => {
    const term = q.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (term) {
      return menu.products.filter((p) => p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(term));
    }
    return menu.products.filter((p) => p.categoryId === cat);
  }, [menu.products, cat, q]);

  const catColor = new Map(menu.categories.map((c) => [c.id, c.color]));

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="p-3 lg:p-4 space-y-3 border-b border-border bg-surface shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en la carta…"
            className="w-full h-11 pl-9 pr-9 rounded-2xl border border-border bg-surface text-base lg:text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-xl text-text-muted hover:bg-surface-secondary" aria-label="Limpiar">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {!q && (
          <div className="snap-x-chips gap-2 -mx-1 px-1">
            {menu.categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setCat(c.id)}
                className={cn("h-10 px-4 rounded-xl border text-sm font-semibold whitespace-nowrap transition-colors", c.id === cat ? "text-white border-transparent" : "border-border text-text-secondary bg-surface hover:bg-surface-secondary")}
                style={c.id === cat ? { background: solidColor(c.color) } : undefined}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scroll-contain p-3 lg:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {products.map((p) => {
            const color = p.categoryId ? catColor.get(p.categoryId) : "neutral";
            const hasOptions = p.groups.length > 0 || p.openPrice;
            return (
              <button
                key={p.id}
                disabled={!p.available || disabled || busyId === p.id}
                onClick={() => onPick(p)}
                className={cn(
                  "fs-press relative text-left rounded-2xl border border-border bg-surface p-3 min-h-[5.5rem] flex flex-col transition-colors overflow-hidden",
                  p.available ? "hover:border-border-strong" : "opacity-50",
                  busyId === p.id && "opacity-60",
                )}
              >
                <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: softColor(color) }} />
                <span className="text-sm font-semibold leading-snug text-text-primary line-clamp-2 pl-1">{p.name}</span>
                <span className="mt-auto pt-2 pl-1 flex items-center justify-between gap-1">
                  <span className="text-sm font-semibold tabular-nums text-text-secondary">{p.openPrice ? "Precio libre" : formatCurrency(p.price)}</span>
                  {!p.available ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-error"><Ban className="w-3 h-3" /> Sin stock</span>
                  ) : hasOptions ? (
                    <SlidersHorizontal className="w-3.5 h-3.5 text-text-muted" />
                  ) : null}
                </span>
              </button>
            );
          })}
          {products.length === 0 && <p className="col-span-full py-10 text-center text-sm text-text-muted">{q ? `Nada con "${q}".` : "Sin productos en esta categoría."}</p>}
        </div>
      </div>
    </div>
  );
}
