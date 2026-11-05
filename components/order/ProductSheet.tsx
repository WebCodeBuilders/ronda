"use client";

import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { Button, CurrencyInput, Sheet, Textarea } from "@/components/ui";
import type { MenuProduct } from "@/lib/orders/queries";
import { COURSE_LABEL } from "@/lib/orders/labels";
import { formatCurrency, round2, cn } from "@/lib/utils";

export type ProductChoice = { productId: string; quantity: number; modifierIds: string[]; notes: string | null; course: number; seat: number | null; price?: number };

/**
 * Opciones de un plato: modificadores (con su mínimo y máximo), cantidad,
 * aclaración para la cocina, paso y comensal.
 */
export function ProductSheet({ product, guests, onClose, onConfirm, busy }: { product: MenuProduct; guests: number; onClose: () => void; onConfirm: (c: ProductChoice) => void; busy: boolean }) {
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const [course, setCourse] = useState(product.course);
  const [seat, setSeat] = useState<number | null>(null);
  const [price, setPrice] = useState<number | null>(product.openPrice ? null : product.price);

  const missing = product.groups.find((g) => (picked[g.id]?.length ?? 0) < g.min);
  const extra = product.groups.flatMap((g) => g.options.filter((o) => picked[g.id]?.includes(o.id))).reduce((s, o) => s + o.priceDelta, 0);
  const unit = round2((price ?? 0) + extra);

  function toggle(groupId: string, optId: string, max: number) {
    setPicked((p) => {
      const cur = p[groupId] ?? [];
      if (cur.includes(optId)) return { ...p, [groupId]: cur.filter((x) => x !== optId) };
      if (max === 1) return { ...p, [groupId]: [optId] };
      if (max > 0 && cur.length >= max) return p;
      return { ...p, [groupId]: [...cur, optId] };
    });
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={product.name}
      description={product.description ?? undefined}
      maxWidth="max-w-lg"
      footer={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-2xl border border-border p-1">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface-secondary" aria-label="Menos"><Minus className="w-4 h-4" /></button>
            <span className="w-8 text-center text-lg font-semibold tabular-nums">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="w-10 h-10 rounded-xl flex items-center justify-center hover:bg-surface-secondary" aria-label="Más"><Plus className="w-4 h-4" /></button>
          </div>
          <Button
            className="flex-1"
            size="lg"
            loading={busy}
            disabled={!!missing || price === null}
            onClick={() => onConfirm({ productId: product.id, quantity: qty, modifierIds: Object.values(picked).flat(), notes: notes.trim() || null, course, seat, price: product.openPrice ? price ?? 0 : undefined })}
          >
            {missing ? `Elegí ${missing.name.toLowerCase()}` : `Agregar · ${formatCurrency(unit * qty)}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {product.openPrice && (
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Precio</p>
            <CurrencyInput value={price} onChange={setPrice} autoFocus />
          </div>
        )}
        {product.groups.map((g) => (
          <div key={g.id}>
            <div className="flex items-baseline justify-between mb-2">
              <p className="text-sm font-semibold text-text-primary">{g.name}</p>
              <span className={cn("text-xs", (picked[g.id]?.length ?? 0) < g.min ? "text-warning-strong font-semibold" : "text-text-muted")}>
                {g.min > 0 ? "Obligatorio" : "Opcional"}{g.max > 1 ? ` · hasta ${g.max}` : ""}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {g.options.filter((o) => o.available).map((o) => {
                const on = picked[g.id]?.includes(o.id);
                return (
                  <button
                    key={o.id}
                    onClick={() => toggle(g.id, o.id, g.max)}
                    className={cn("min-h-11 px-3 py-2 rounded-xl border text-left text-sm flex items-center gap-2 transition-colors", on ? "border-accent bg-accent-light text-accent font-semibold" : "border-border text-text-primary hover:bg-surface-secondary")}
                  >
                    <span className={cn("w-4 h-4 shrink-0 border-2 flex items-center justify-center", g.max === 1 ? "rounded-full" : "rounded-md", on ? "border-accent bg-accent text-white" : "border-border-strong")}>
                      {on && <Check className="w-3 h-3" strokeWidth={3} />}
                    </span>
                    <span className="flex-1 leading-tight">{o.name}</span>
                    {o.priceDelta !== 0 && <span className="text-xs tabular-nums text-text-secondary">+{formatCurrency(o.priceDelta)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <Textarea label="Aclaración para la cocina" placeholder="Sin sal, bien cocido, para compartir…" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div>
          <p className="text-sm font-semibold text-text-primary mb-2">Sale en</p>
          <div className="flex flex-wrap gap-2">
            {[0, 1, 2, 3, 4].map((c) => (
              <button key={c} onClick={() => setCourse(c)} className={cn("h-10 px-3 rounded-xl border text-sm font-medium", course === c ? "border-accent bg-accent-light text-accent" : "border-border text-text-secondary hover:bg-surface-secondary")}>
                {COURSE_LABEL[c]}
              </button>
            ))}
          </div>
        </div>
        {guests > 1 && (
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Comensal <span className="font-normal text-text-muted">(para dividir la cuenta por persona)</span></p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setSeat(null)} className={cn("h-10 px-3 rounded-xl border text-sm font-medium", seat === null ? "border-accent bg-accent-light text-accent" : "border-border text-text-secondary")}>Compartido</button>
              {Array.from({ length: Math.min(guests, 20) }, (_, i) => i + 1).map((n) => (
                <button key={n} onClick={() => setSeat(n)} className={cn("h-10 w-10 rounded-xl border text-sm font-semibold tabular-nums", seat === n ? "border-accent bg-accent-light text-accent" : "border-border text-text-secondary")}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
