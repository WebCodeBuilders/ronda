"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Button, CurrencyInput, Input, Select, Switch, Textarea } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import { COURSE_LABEL } from "@/lib/orders/labels";
import { formatCurrency, formatPercent, round2, cn } from "@/lib/utils";

type P = {
  id?: string; name: string; shortName: string | null; description: string | null; categoryId: string | null; stationId: string | null; price: number; cost: number;
  course: number; prepMinutes: number; available: boolean; showInQrMenu: boolean; skipKitchen: boolean; openPrice: boolean; imageUrl: string | null; tags: string[];
  modifierGroupIds: string[]; recipe: { ingredientId: string; quantity: number }[];
};

const TAGS = ["vegano", "vegetariano", "sin TACC", "picante", "nuevo", "recomendado"];

/** Alta y edición de un producto: el mismo formulario. */
export function ProductForm({ initial, defaultCategoryId, categories, stations, groups, ingredients }: {
  initial: P | null; defaultCategoryId: string | null;
  categories: { id: string; name: string; stationId: string | null }[];
  stations: { id: string; name: string }[];
  groups: { id: string; name: string; summary: string }[];
  ingredients: { id: string; name: string; unit: string; cost: number }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [p, setP] = useState<P>(
    initial ?? {
      name: "", shortName: null, description: null, categoryId: defaultCategoryId, stationId: null, price: 0, cost: 0, course: 2, prepMinutes: 10,
      available: true, showInQrMenu: true, skipKitchen: false, openPrice: false, imageUrl: null, tags: [], modifierGroupIds: [], recipe: [],
    },
  );
  const [busy, setBusy] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const set = <K extends keyof P>(k: K, v: P[K]) => setP((x) => ({ ...x, [k]: v }));

  const recipeCost = round2(p.recipe.reduce((s, r) => s + (ingredients.find((i) => i.id === r.ingredientId)?.cost ?? 0) * r.quantity, 0));
  const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
  const catStation = categories.find((c) => c.id === p.categoryId)?.stationId;

  async function save() {
    setBusy(true);
    try {
      if (p.id) await api(`/api/products/${p.id}`, { method: "PUT", body: p });
      else await api("/api/products", { body: p });
      toast.success("Producto guardado");
      router.push("/carta");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    try {
      await api(`/api/products/${p.id}`, { method: "DELETE" });
      toast.success("Producto dado de baja");
      router.push("/carta");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <PageContainer width="narrow">
      <PageHeader
        title={p.id ? p.name || "Producto" : "Nuevo producto"}
        back={{ href: "/carta", label: "Carta" }}
        action={p.id ? <Button variant="danger-outline" size="sm" onClick={() => setConfirmDel(true)}>Dar de baja</Button> : undefined}
      />
      <div className="space-y-3 lg:space-y-4 pb-24">
        <Section title="Datos">
          <Input label="Nombre en la carta" value={p.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
          <Input label="Nombre corto para la comanda (opcional)" hint="Lo que lee la cocina. Ej.: Mila napo" value={p.shortName ?? ""} onChange={(e) => set("shortName", e.target.value || null)} maxLength={30} />
          <Textarea label="Descripción (carta QR)" rows={2} value={p.description ?? ""} onChange={(e) => set("description", e.target.value || null)} />
          <div className="grid sm:grid-cols-2 gap-3">
            <Select label="Categoría" value={p.categoryId ?? ""} placeholder="Sin categoría" onChange={(e) => set("categoryId", e.target.value || null)} options={categories.map((c) => ({ value: c.id, label: c.name }))} />
            <Select
              label="Se prepara en"
              value={p.stationId ?? ""}
              placeholder={`Lo de la categoría${catStation ? ` (${stations.find((s) => s.id === catStation)?.name})` : ""}`}
              onChange={(e) => set("stationId", e.target.value || null)}
              options={stations.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-1.5">Etiquetas</p>
            <div className="flex flex-wrap gap-2">
              {TAGS.map((t) => {
                const on = p.tags.includes(t);
                return (
                  <button key={t} type="button" onClick={() => set("tags", on ? p.tags.filter((x) => x !== t) : [...p.tags, t])} className={cn("h-9 px-3 rounded-xl border text-xs font-semibold", on ? "border-accent bg-accent-light text-accent" : "border-border text-text-secondary")}>
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        </Section>

        <Section title="Precio y costo">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <p className="text-sm font-medium mb-1.5">Precio de venta</p>
              <CurrencyInput value={p.price} onChange={(v) => set("price", v ?? 0)} disabled={p.openPrice} />
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">Costo</p>
              <CurrencyInput value={p.cost} onChange={(v) => set("cost", v ?? 0)} />
              {recipeCost > 0 && Math.abs(recipeCost - p.cost) > 0.01 && (
                <button type="button" onClick={() => set("cost", recipeCost)} className="text-xs font-semibold text-accent mt-1 hover:underline">Usar costo de la receta: {formatCurrency(recipeCost)}</button>
              )}
            </div>
            <div className="rounded-2xl bg-surface-secondary p-3">
              <p className="text-xs text-text-secondary">Margen</p>
              <p className={cn("text-lg font-bold tabular-nums", margin < 50 ? "text-warning-strong" : "text-success-strong")}>{p.price > 0 ? formatPercent(margin) : "—"}</p>
              <p className="text-xs text-text-muted tabular-nums">Ganás {formatCurrency(p.price - p.cost)}</p>
            </div>
          </div>
          <Toggle label="Precio libre" hint="Se carga al vender (pesca del día, varios)." checked={p.openPrice} onChange={(v) => set("openPrice", v)} />
        </Section>

        <Section title="Cocina">
          <div>
            <p className="text-sm font-medium mb-1.5">Sale en</p>
            <div className="flex flex-wrap gap-2">
              {[0, 1, 2, 3, 4].map((c) => (
                <button key={c} type="button" onClick={() => set("course", c)} className={cn("h-10 px-3 rounded-xl border text-sm font-medium", p.course === c ? "border-accent bg-accent-light text-accent" : "border-border text-text-secondary")}>{COURSE_LABEL[c]}</button>
              ))}
            </div>
          </div>
          <Input label="Minutos de preparación" type="number" min={0} value={p.prepMinutes} onChange={(e) => set("prepMinutes", Math.max(0, Number(e.target.value) || 0))} className="max-w-[10rem]" />
          <Toggle label="No pasa por cocina" hint="Agua, gaseosa en lata, vino por copa: se da por entregado al marchar." checked={p.skipKitchen} onChange={(v) => set("skipKitchen", v)} />
          <Toggle label="Disponible" hint="Apagalo cuando se termina (también desde la pantalla de cocina)." checked={p.available} onChange={(v) => set("available", v)} />
          <Toggle label="Mostrar en la carta QR" checked={p.showInQrMenu} onChange={(v) => set("showInQrMenu", v)} />
        </Section>

        <Section title="Opciones" hint="Punto de la carne, guarnición, extras. Se editan en Carta › Opciones.">
          {groups.length === 0 && <p className="text-sm text-text-secondary">No hay grupos de opciones todavía.</p>}
          <div className="grid sm:grid-cols-2 gap-2">
            {groups.map((g) => {
              const on = p.modifierGroupIds.includes(g.id);
              return (
                <button key={g.id} type="button" onClick={() => set("modifierGroupIds", on ? p.modifierGroupIds.filter((x) => x !== g.id) : [...p.modifierGroupIds, g.id])} className={cn("text-left rounded-xl border px-3 py-2", on ? "border-accent bg-accent-light" : "border-border hover:bg-surface-secondary")}>
                  <p className={cn("text-sm font-semibold", on ? "text-accent" : "text-text-primary")}>{g.name}</p>
                  <p className="text-xs text-text-muted truncate">{g.summary}</p>
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="Receta" hint="Qué insumos descuenta cada unidad vendida. Opcional.">
          {p.recipe.map((r, i) => {
            const ing = ingredients.find((x) => x.id === r.ingredientId);
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  <Select value={r.ingredientId} onChange={(e) => set("recipe", p.recipe.map((x, j) => (j === i ? { ...x, ingredientId: e.target.value } : x)))} options={ingredients.map((x) => ({ value: x.id, label: `${x.name} (${x.unit})` }))} />
                </div>
                <div className="w-28">
                  <Input type="number" step="0.001" min={0} value={r.quantity} onChange={(e) => set("recipe", p.recipe.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) || 0 } : x)))} aria-label="Cantidad" />
                </div>
                <span className="w-24 pb-2.5 text-xs text-text-muted tabular-nums">{ing ? formatCurrency(ing.cost * r.quantity) : ""}</span>
                <button type="button" onClick={() => set("recipe", p.recipe.filter((_, j) => j !== i))} className="tap-44 flex items-center justify-center rounded-xl text-text-muted hover:bg-surface-secondary" aria-label="Quitar insumo"><X className="w-4 h-4" /></button>
              </div>
            );
          })}
          {ingredients.length > 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={() => set("recipe", [...p.recipe, { ingredientId: ingredients[0]!.id, quantity: 1 }])}>Agregar insumo</Button>
          ) : (
            <p className="text-sm text-text-secondary">Cargá insumos en la pantalla Insumos para armar recetas.</p>
          )}
        </Section>
      </div>

      <div className="fixed bottom-[var(--tabbar-total)] lg:bottom-0 inset-x-0 lg:left-60 z-30 border-t border-border bg-surface/95 backdrop-blur px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => router.push("/carta")}>Cancelar</Button>
          <Button loading={busy} disabled={!p.name.trim()} onClick={save}>Guardar</Button>
        </div>
      </div>

      {confirmDel && (
        <ConfirmDialog title={`Dar de baja ${p.name}`} confirmLabel="Dar de baja" tone="danger" onConfirm={remove} onClose={() => setConfirmDel(false)}>
          Deja de aparecer en la carta y en las terminales. Las ventas que tuvo siguen en los reportes.
        </ConfirmDialog>
      )}
    </PageContainer>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
        {hint && <p className="text-xs text-text-muted mt-0.5">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

export function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-text-primary">{label}</p>
        {hint && <p className="text-xs text-text-muted">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
