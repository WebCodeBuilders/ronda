"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, X } from "lucide-react";
import { Button, Sheet, Textarea } from "@/components/ui";
import { LogoMark } from "@/components/brand/Logo";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import type { MenuData, MenuProduct } from "@/lib/orders/queries";
import { formatCurrency, formatQty, round2, cn } from "@/lib/utils";

type CartLine = { key: string; product: MenuProduct; quantity: number; modifierIds: string[]; notes: string | null; unit: number };

export function QrMenu({ token, orgName, tableName, orderingEnabled, needsApproval, menu, current }: {
  token: string; orgName: string; tableName: string; orderingEnabled: boolean; needsApproval: boolean; menu: MenuData;
  current: { total: number; items: { name: string; quantity: number; total: number; status: string }[] } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [cat, setCat] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [open, setOpen] = useState<MenuProduct | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [showBill, setShowBill] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "order" | "call" | "bill">(null);

  const cats = menu.categories.filter((c) => menu.products.some((p) => p.categoryId === c.id));
  const total = round2(cart.reduce((s, l) => s + l.unit * l.quantity, 0));
  const count = cart.reduce((s, l) => s + l.quantity, 0);

  async function post(body: unknown, kind: "order" | "call" | "bill") {
    setBusy(true);
    try {
      await api(`/api/public/table/${token}`, { body });
      setSent(kind);
      if (kind === "order") {
        setCart([]);
        setShowCart(false);
      }
      setShowBill(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sections = useMemo(() => (cat ? cats.filter((c) => c.id === cat) : cats), [cat, cats]);

  return (
    <div className="min-h-dvh bg-background pb-28">
      <header className="sticky top-0 z-30 bg-surface border-b border-border">
        <div className="h-1" style={{ background: "var(--brand-gradient)" }} />
        <div className="flex items-center gap-2 px-4 h-14">
          <LogoMark className="w-7 h-7 text-accent" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-tight text-text-primary truncate">{orgName}</p>
            <p className="text-xs text-text-muted">Mesa {tableName}</p>
          </div>
        </div>
        <div className="snap-x-chips gap-2 px-4 pb-3">
          <button onClick={() => setCat(null)} className={cn("h-9 px-3 rounded-xl border text-sm font-semibold", !cat ? "bg-accent text-white border-accent" : "border-border text-text-secondary")}>Todo</button>
          {cats.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id)} className={cn("h-9 px-3 rounded-xl border text-sm font-semibold whitespace-nowrap", cat === c.id ? "bg-accent text-white border-accent" : "border-border text-text-secondary")}>{c.name}</button>
          ))}
        </div>
      </header>

      {sent && (
        <div className="mx-4 mt-4 rounded-2xl bg-success-subtle border border-success-border p-4 flex items-start gap-3 fs-fade-in">
          <Check className="w-5 h-5 text-success-strong mt-0.5" />
          <div className="flex-1 text-sm text-success-strong">
            <p className="font-semibold">{sent === "order" ? (needsApproval ? "¡Recibimos tu pedido!" : "¡Tu pedido ya está en la cocina!") : sent === "call" ? "Avisamos al mozo" : "Pediste la cuenta"}</p>
            <p>{sent === "order" ? (needsApproval ? "El mozo lo confirma en un momento." : "Te lo llevamos apenas esté.") : "Ya viene a tu mesa."}</p>
          </div>
          <button onClick={() => setSent(null)} className="text-success-strong" aria-label="Cerrar"><X className="w-4 h-4" /></button>
        </div>
      )}

      <main className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
        {sections.map((c) => (
          <section key={c.id}>
            <h2 className="text-lg font-bold text-text-primary mb-2">{c.name}</h2>
            <div className="rounded-2xl border border-border bg-surface divide-y divide-border overflow-hidden">
              {menu.products.filter((p) => p.categoryId === c.id).map((p) => (
                <button key={p.id} onClick={() => orderingEnabled && !p.openPrice && setOpen(p)} className="w-full text-left flex gap-3 px-4 py-3 hover:bg-surface-secondary">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-text-primary">{p.name}</p>
                    {p.description && <p className="text-xs text-text-secondary mt-0.5 leading-snug">{p.description}</p>}
                    {p.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {p.tags.map((t) => (
                          <span key={t} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-success-light text-success-strong">
                            {t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold tabular-nums text-text-primary">{p.openPrice ? "Consultar" : formatCurrency(p.price)}</p>
                    {orderingEnabled && !p.openPrice && <span className="mt-1 inline-flex w-8 h-8 rounded-xl bg-accent-light text-accent items-center justify-center"><Plus className="w-4 h-4" /></span>}
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}
      </main>

      <div className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border px-4 py-3 pb-safe">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Button variant="outline" className="flex-1" loading={busy && !showBill && !showCart} onClick={() => post({ action: "call" }, "call")}>Mozo</Button>
          <Button variant="outline" className="flex-1" onClick={() => setShowBill(true)}>Cuenta</Button>
          {count > 0 && (
            <Button className="flex-[2]" onClick={() => setShowCart(true)}>Ver pedido ({count}) · {formatCurrency(total)}</Button>
          )}
        </div>
      </div>

      {open && <ProductPicker product={open} onClose={() => setOpen(null)} onAdd={(l) => { setCart((c) => [...c, l]); setOpen(null); toast.success(`Agregaste ${l.product.name}`); }} />}

      <Sheet open={showCart} onClose={() => setShowCart(false)} title="Tu pedido" maxWidth="max-w-lg"
        footer={<Button fullWidth size="lg" loading={busy} disabled={cart.length === 0} onClick={() => post({ action: "order", items: cart.map((l) => ({ productId: l.product.id, quantity: l.quantity, modifierIds: l.modifierIds, notes: l.notes })) }, "order")}>Enviar pedido · {formatCurrency(total)}</Button>}
      >
        <div className="divide-y divide-border -mx-1">
          {cart.map((l) => (
            <div key={l.key} className="flex items-center gap-3 px-1 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{l.product.name}</p>
                {l.notes && <p className="text-xs text-text-muted">{l.notes}</p>}
              </div>
              <div className="flex items-center gap-1 rounded-xl border border-border">
                <button onClick={() => setCart((c) => c.flatMap((x) => (x.key === l.key ? (x.quantity > 1 ? [{ ...x, quantity: x.quantity - 1 }] : []) : [x])))} className="w-8 h-8 flex items-center justify-center" aria-label="Menos"><Minus className="w-3.5 h-3.5" /></button>
                <span className="w-5 text-center text-sm font-semibold tabular-nums">{l.quantity}</span>
                <button onClick={() => setCart((c) => c.map((x) => (x.key === l.key ? { ...x, quantity: x.quantity + 1 } : x)))} className="w-8 h-8 flex items-center justify-center" aria-label="Más"><Plus className="w-3.5 h-3.5" /></button>
              </div>
              <span className="w-24 text-right text-sm font-semibold tabular-nums">{formatCurrency(l.unit * l.quantity)}</span>
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={showBill} onClose={() => setShowBill(false)} title="Pedir la cuenta" description="¿Cómo vas a pagar? Así el mozo viene preparado." maxWidth="max-w-sm">
        {current && current.items.length > 0 && (
          <div className="rounded-2xl bg-surface-secondary p-3 mb-4 text-sm">
            {current.items.map((i, k) => (
              <div key={k} className="flex justify-between gap-2"><span>{formatQty(i.quantity)}× {i.name}</span><span className="tabular-nums">{formatCurrency(i.total)}</span></div>
            ))}
            <div className="flex justify-between font-bold pt-2 mt-2 border-t border-border"><span>Total</span><span className="tabular-nums">{formatCurrency(current.total)}</span></div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          {["Efectivo", "Tarjeta", "QR / billetera", "Dividir la cuenta"].map((p) => (
            <Button key={p} variant="outline" disabled={busy} onClick={() => post({ action: "bill", preference: p }, "bill")}>{p}</Button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function ProductPicker({ product, onClose, onAdd }: { product: MenuProduct; onClose: () => void; onAdd: (l: CartLine) => void }) {
  const [qty, setQty] = useState(1);
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState("");
  const missing = product.groups.find((g) => (picked[g.id]?.length ?? 0) < g.min);
  const extra = product.groups.flatMap((g) => g.options.filter((o) => picked[g.id]?.includes(o.id))).reduce((s, o) => s + o.priceDelta, 0);
  const unit = round2(product.price + extra);
  function toggle(gid: string, oid: string, max: number) {
    setPicked((p) => {
      const cur = p[gid] ?? [];
      if (cur.includes(oid)) return { ...p, [gid]: cur.filter((x) => x !== oid) };
      if (max === 1) return { ...p, [gid]: [oid] };
      if (max > 0 && cur.length >= max) return p;
      return { ...p, [gid]: [...cur, oid] };
    });
  }
  return (
    <Sheet open onClose={onClose} title={product.name} description={product.description ?? undefined} maxWidth="max-w-lg"
      footer={
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 rounded-2xl border border-border p-1">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl flex items-center justify-center" aria-label="Menos"><Minus className="w-4 h-4" /></button>
            <span className="w-6 text-center font-semibold tabular-nums">{qty}</span>
            <button onClick={() => setQty((q) => q + 1)} className="w-10 h-10 rounded-xl flex items-center justify-center" aria-label="Más"><Plus className="w-4 h-4" /></button>
          </div>
          <Button className="flex-1" size="lg" disabled={!!missing} onClick={() => onAdd({ key: `${product.id}-${Date.now()}`, product, quantity: qty, modifierIds: Object.values(picked).flat(), notes: notes.trim() || null, unit })}>
            {missing ? `Elegí ${missing.name.toLowerCase()}` : `Agregar · ${formatCurrency(unit * qty)}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {product.groups.map((g) => (
          <div key={g.id}>
            <p className="text-sm font-semibold mb-2">{g.name} <span className="font-normal text-text-muted text-xs">{g.min > 0 ? "· obligatorio" : "· opcional"}</span></p>
            <div className="space-y-1.5">
              {g.options.filter((o) => o.available).map((o) => {
                const on = picked[g.id]?.includes(o.id);
                return (
                  <button key={o.id} onClick={() => toggle(g.id, o.id, g.max)} className={cn("w-full min-h-11 px-3 rounded-xl border text-left text-sm flex items-center gap-2", on ? "border-accent bg-accent-light text-accent font-semibold" : "border-border")}>
                    <span className={cn("w-4 h-4 border-2 flex items-center justify-center", g.max === 1 ? "rounded-full" : "rounded-md", on ? "border-accent bg-accent text-white" : "border-border-strong")}>{on && <Check className="w-3 h-3" strokeWidth={3} />}</span>
                    <span className="flex-1">{o.name}</span>
                    {o.priceDelta !== 0 && <span className="text-xs tabular-nums">+{formatCurrency(o.priceDelta)}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <Textarea label="¿Alguna aclaración?" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Sin sal, sin cebolla, celíaco…" />
      </div>
    </Sheet>
  );
}
