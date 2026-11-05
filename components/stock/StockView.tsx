"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, CurrencyInput, Input, Select, Sheet, tableCls } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import { formatCurrency, formatDate, formatQty, cn } from "@/lib/utils";

type I = { id: string; name: string; unit: string; stock: number; minStock: number; cost: number; recipes: number; weekUse: number };
const KIND_LABEL: Record<string, string> = { PURCHASE: "Compra", WASTE: "Merma", ADJUST: "Conteo", RETURN: "Devolución" };
const UNITS = [{ value: "u", label: "Unidades" }, { value: "kg", label: "Kilos" }, { value: "g", label: "Gramos" }, { value: "l", label: "Litros" }, { value: "ml", label: "Mililitros" }];

/** Insumos con stock que baja solo al vender (por receta) y alertas de mínimo. */
export function StockView({ ingredients, movements }: { ingredients: I[]; movements: { id: string; name: string; unit: string; kind: string; quantity: number; note: string | null; createdAt: string }[] }) {
  const [edit, setEdit] = useState<Partial<I> | null>(null);
  const [move, setMove] = useState<{ i: I; kind: "PURCHASE" | "WASTE" | "ADJUST" } | null>(null);
  const low = ingredients.filter((i) => i.stock <= i.minStock);
  const value = ingredients.reduce((s, i) => s + Math.max(0, i.stock) * i.cost, 0);
  return (
    <PageContainer width="wide">
      <PageHeader title="Insumos" meta={<span className="text-sm text-text-secondary">Valor en stock {formatCurrency(value)}</span>} action={<Button size="sm" onClick={() => setEdit({ unit: "u", minStock: 0, cost: 0 })}>Nuevo insumo</Button>} />
      {low.length > 0 && <p className="mb-3 rounded-2xl bg-warning-subtle border border-warning-border px-4 py-2.5 text-sm text-warning-strong">{low.length} {low.length === 1 ? "insumo está" : "insumos están"} en el mínimo o por debajo: {low.map((l) => l.name).join(", ")}.</p>}
      {/* Celular: tarjeta con barra de stock contra el mínimo y un botón de movimiento. */}
      <div className="md:hidden space-y-2">
        {ingredients.map((i) => {
          const pct = Math.min(100, i.minStock > 0 ? (i.stock / (i.minStock * 3)) * 100 : 100);
          const tone = i.stock <= 0 ? "var(--error)" : i.stock <= i.minStock ? "var(--warning)" : "var(--success)";
          return (
            <div key={i.id} className="rounded-2xl border border-border bg-surface p-3">
              <div className="flex items-baseline justify-between gap-3">
                <button onClick={() => setEdit(i)} className="text-[15px] font-semibold text-text-primary text-left">{i.name}</button>
                <span className="text-sm font-bold tabular-nums" style={{ color: tone }}>{formatQty(i.stock)} {i.unit}</span>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-surface-secondary overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.max(3, pct)}%`, background: tone }} /></div>
              <p className="text-xs text-text-muted mt-1.5">Mínimo {formatQty(i.minStock)} {i.unit}{i.weekUse > 0 ? ` · alcanza para ~${Math.max(0, Math.floor(i.stock / (i.weekUse / 7)))} días` : ""}</p>
              <div className="grid grid-cols-3 gap-2 mt-3">
                <Button size="sm" variant="outline" onClick={() => setMove({ i, kind: "PURCHASE" })}>Compra</Button>
                <Button size="sm" variant="outline" onClick={() => setMove({ i, kind: "WASTE" })}>Merma</Button>
                <Button size="sm" variant="outline" onClick={() => setMove({ i, kind: "ADJUST" })}>Conteo</Button>
              </div>
            </div>
          );
        })}
      </div>
      <div className={cn(tableCls.frame, "hidden md:block")}>
        <div className={tableCls.scroll}>
          <table className={tableCls.table}>
            <thead className={tableCls.thead}><tr><th className={tableCls.th}>Insumo</th><th className={cn(tableCls.th, tableCls.thRight)}>Stock</th><th className={cn(tableCls.th, tableCls.thRight, "hidden sm:table-cell")}>Mínimo</th><th className={cn(tableCls.th, tableCls.thRight, "hidden md:table-cell")}>Uso 7 días</th><th className={cn(tableCls.th, tableCls.thRight, "hidden md:table-cell")}>Costo</th><th className={tableCls.th} /></tr></thead>
            <tbody>
              {ingredients.map((i) => {
                const days = i.weekUse > 0 ? i.stock / (i.weekUse / 7) : null;
                return (
                  <tr key={i.id} className={tableCls.tr}>
                    <td className={tableCls.td}>{i.name}<div className={tableCls.sub}>{i.recipes ? `En ${i.recipes} ${i.recipes === 1 ? "receta" : "recetas"}` : "Sin recetas"}{days !== null ? ` · alcanza para ~${Math.max(0, Math.floor(days))} días` : ""}</div></td>
                    <td className={cn(tableCls.td, tableCls.tdRight, "font-semibold", i.stock <= 0 ? "text-error" : i.stock <= i.minStock ? "text-warning" : "text-success")}>{formatQty(i.stock)} {i.unit}</td>
                    <td className={cn(tableCls.td, tableCls.tdRight, tableCls.tdMuted, "hidden sm:table-cell")}>{formatQty(i.minStock)}</td>
                    <td className={cn(tableCls.td, tableCls.tdRight, tableCls.tdMuted, "hidden md:table-cell")}>{formatQty(i.weekUse)}</td>
                    <td className={cn(tableCls.td, tableCls.tdRight, tableCls.tdMuted, "hidden md:table-cell")}>{formatCurrency(i.cost)}</td>
                    <td className={cn(tableCls.td, "whitespace-nowrap text-right")}>
                      <div className="inline-flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => setMove({ i, kind: "PURCHASE" })}>Compra</Button>
                        <Button size="sm" variant="ghost" onClick={() => setMove({ i, kind: "WASTE" })}>Merma</Button>
                        <Button size="sm" variant="ghost" onClick={() => setMove({ i, kind: "ADJUST" })}>Conteo</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEdit(i)}>Editar</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {ingredients.length === 0 && <tr><td colSpan={6} className={cn(tableCls.td, "py-10 text-center text-text-secondary")}>Cargá tus insumos y asocialos a las recetas de la carta: el stock baja solo con cada venta.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {movements.length > 0 && (
        <div className="mt-4">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Últimos movimientos</h2>
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {movements.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <span className="text-text-secondary"><Badge tone={m.kind === "PURCHASE" ? "success" : m.kind === "WASTE" ? "error" : "neutral"}>{KIND_LABEL[m.kind] ?? m.kind}</Badge> <span className="ml-2 text-text-primary">{m.name}</span>{m.note ? ` · ${m.note}` : ""}</span>
                <span className="tabular-nums whitespace-nowrap">{m.quantity > 0 ? "+" : ""}{formatQty(m.quantity)} {m.unit} · <span className="text-text-muted">{formatDate(m.createdAt)}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}
      {edit && <EditSheet item={edit} onClose={() => setEdit(null)} />}
      {move && <MoveSheet item={move.i} kind={move.kind} onClose={() => setMove(null)} />}
    </PageContainer>
  );
}

function EditSheet({ item, onClose }: { item: Partial<I>; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [i, setI] = useState(item);
  async function save() {
    try {
      const body = { name: i.name, unit: i.unit, minStock: i.minStock ?? 0, cost: i.cost ?? 0, stock: i.stock };
      if (i.id) await api(`/api/ingredients/${i.id}`, { method: "PUT", body });
      else await api("/api/ingredients", { body });
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Sheet open onClose={onClose} title={i.id ? i.name : "Nuevo insumo"} maxWidth="max-w-sm" footer={<Button fullWidth disabled={!i.name?.trim()} onClick={save}>Guardar</Button>}>
      <div className="space-y-3">
        <Input label="Nombre" value={i.name ?? ""} onChange={(e) => setI({ ...i, name: e.target.value })} />
        <Select label="Unidad" value={i.unit ?? "u"} onChange={(e) => setI({ ...i, unit: e.target.value })} options={UNITS} />
        {!i.id && <Input label="Stock inicial" type="number" value={i.stock ?? 0} onChange={(e) => setI({ ...i, stock: Number(e.target.value) || 0 })} />}
        <Input label="Stock mínimo (alerta)" type="number" value={i.minStock ?? 0} onChange={(e) => setI({ ...i, minStock: Number(e.target.value) || 0 })} />
        <div><p className="text-sm font-medium mb-1.5">Costo por unidad</p><CurrencyInput value={i.cost ?? 0} onChange={(v) => setI({ ...i, cost: v ?? 0 })} /></div>
      </div>
    </Sheet>
  );
}

function MoveSheet({ item, kind, onClose }: { item: I; kind: "PURCHASE" | "WASTE" | "ADJUST"; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [qty, setQty] = useState(kind === "ADJUST" ? item.stock : 0);
  const [cost, setCost] = useState<number | null>(item.cost);
  const [note, setNote] = useState("");
  const title = kind === "PURCHASE" ? "Compra" : kind === "WASTE" ? "Merma" : "Conteo físico";
  async function save() {
    try {
      await api(`/api/ingredients/${item.id}/move`, { body: { kind, quantity: qty, note: note || null, unitCost: kind === "PURCHASE" ? cost ?? undefined : undefined } });
      toast.success(`${title} registrada`);
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Sheet open onClose={onClose} title={`${title}: ${item.name}`} description={`Hay ${formatQty(item.stock)} ${item.unit}`} maxWidth="max-w-sm" footer={<Button fullWidth onClick={save}>Registrar</Button>}>
      <div className="space-y-3">
        <Input label={kind === "ADJUST" ? `Contaste (${item.unit})` : `Cantidad (${item.unit})`} type="number" step="0.001" value={qty} onChange={(e) => setQty(Number(e.target.value) || 0)} autoFocus />
        {kind === "PURCHASE" && <div><p className="text-sm font-medium mb-1.5">Costo por {item.unit}</p><CurrencyInput value={cost} onChange={setCost} /></div>}
        <Input label="Nota" value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "WASTE" ? "Se venció, se quemó…" : "Proveedor, factura…"} />
      </div>
    </Sheet>
  );
}
