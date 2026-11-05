"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { MenuData, MenuProduct } from "@/lib/orders/queries";
import { softColor, solidColor } from "@/lib/colors";
import { formatCurrency, formatQty, cn } from "@/lib/utils";

/**
 * La carta para cargar: categorías arriba, buscador, y tarjetas grandes con
 * el color de su categoría. Un toque agrega; si el plato tiene opciones se
 * abren. El número arriba a la derecha dice cuántos hay ya en la cuenta.
 */
export function MenuPanel({ menu, onPick, busyId, disabled, counts = {} }: {
  menu: MenuData;
  onPick: (p: MenuProduct) => void;
  busyId: string | null;
  disabled?: boolean;
  counts?: Record<string, number>;
}) {
  // Lo que no tiene categoría va a una pestaña "Otros" para que nunca quede escondido.
  const hasLoose = menu.products.some((p) => !p.categoryId || !menu.categories.some((c) => c.id === p.categoryId));
  // Al cargar un pedido, una categoría vacía no sirve: no se muestra.
  const withProducts = menu.categories.filter((c) => menu.products.some((p) => p.categoryId === c.id));
  const tabs = hasLoose ? [...withProducts, { id: "__otros", name: "Otros", color: "neutral" }] : withProducts;
  const [cat, setCat] = useState<string | null>(tabs[0]?.id ?? null);
  const [q, setQ] = useState("");

  const products = useMemo(() => {
    const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const term = norm(q.trim());
    if (term) return menu.products.filter((p) => norm(p.name).includes(term));
    if (cat === "__otros") return menu.products.filter((p) => !p.categoryId || !menu.categories.some((c) => c.id === p.categoryId));
    return menu.products.filter((p) => p.categoryId === cat);
  }, [menu.products, menu.categories, cat, q]);

  const catColor = new Map(menu.categories.map((c) => [c.id, c.color]));
  const catCount = (id: string) =>
    menu.products.filter((p) => (id === "__otros" ? !p.categoryId || !catColor.has(p.categoryId) : p.categoryId === id)).reduce((s, p) => s + (counts[p.id] ?? 0), 0);

  return (
    <div className="flex flex-col min-h-0 h-full">
      <div className="px-3 pt-3 pb-2 lg:px-4 lg:pt-4 space-y-3 border-b border-border bg-surface shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar en la carta"
            className="w-full h-11 pl-9 pr-9 rounded-2xl border border-border bg-surface-secondary/60 text-base lg:text-sm outline-none focus:bg-surface focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
          {q && (
            <button onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center rounded-xl text-text-muted hover:bg-surface-secondary" aria-label="Limpiar búsqueda">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {!q && (
          <div className="snap-x-chips gap-1.5 -mx-1 px-1 pb-1">
            {tabs.map((c) => {
              const on = c.id === cat;
              const n = catCount(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setCat(c.id)}
                  className={cn("h-10 px-4 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors flex items-center gap-2", on ? "text-white" : "text-text-secondary hover:text-text-primary")}
                  style={on ? { background: solidColor(c.color) } : { background: softColor(c.color) }}
                >
                  {c.name}
                  {n > 0 && <span className={cn("min-w-5 h-5 px-1 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums", on ? "bg-white/25" : "bg-surface")}>{formatQty(n)}</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto scroll-contain p-3 lg:p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2.5">
          {products.map((p) => {
            const color = p.categoryId ? catColor.get(p.categoryId) : "neutral";
            const n = counts[p.id] ?? 0;
            const hasOptions = p.groups.length > 0 || p.openPrice;
            return (
              <button
                key={p.id}
                disabled={!p.available || disabled || busyId === p.id}
                onClick={() => onPick(p)}
                className={cn(
                  "fs-press relative text-left rounded-2xl border bg-surface min-h-[6.5rem] flex flex-col overflow-hidden transition-colors",
                  n > 0 ? "border-accent" : "border-border hover:border-border-strong",
                  !p.available && "opacity-45",
                  busyId === p.id && "opacity-60",
                )}
              >
                <span className="h-1.5 w-full shrink-0" style={{ background: solidColor(color) }} />
                <span className="flex-1 flex flex-col p-3 pt-2.5">
                  <span className="text-[15px] lg:text-sm font-semibold leading-snug text-text-primary line-clamp-2 pr-6">{p.name}</span>
                  <span className="mt-auto pt-2 flex items-baseline justify-between gap-1">
                    <span className="text-sm font-semibold tabular-nums text-text-primary">{p.openPrice ? "Precio libre" : formatCurrency(p.price)}</span>
                    {!p.available ? <span className="text-[11px] font-semibold text-error">Sin stock</span> : hasOptions ? <span className="text-[11px] text-text-muted">Opciones</span> : null}
                  </span>
                </span>
                {n > 0 && (
                  <span className="absolute top-3 right-2.5 min-w-6 h-6 px-1.5 rounded-full bg-accent text-white text-xs font-bold flex items-center justify-center tabular-nums">
                    {formatQty(n)}
                  </span>
                )}
              </button>
            );
          })}
          {products.length === 0 && <p className="col-span-full py-10 text-center text-sm text-text-muted">{q ? `No hay nada con "${q}".` : "No hay productos en esta categoría."}</p>}
        </div>
      </div>
    </div>
  );
}
