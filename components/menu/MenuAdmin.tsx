"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, Percent, Plus, Search, Trash2, X, ArrowUp, ArrowDown } from "lucide-react";
import { Badge, Button, Input, Select, Sheet, Switch } from "@/components/ui";
import { CurrencyInput } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useLiveRefresh } from "@/lib/realtime/client";
import { api } from "@/lib/client/api";
import { COLOR_LABEL, COLOR_OPTIONS, solidColor } from "@/lib/colors";
import { formatCurrency, formatPercent, cn } from "@/lib/utils";

type Cat = { id: string; name: string; color: string; stationId: string | null; stationName: string | null; count: number };
type Prod = { id: string; name: string; categoryId: string | null; price: number; cost: number; available: boolean; showInQrMenu: boolean; station: string | null; tags: string[]; openPrice: boolean };
type Group = { id: string; name: string; minSelect: number; maxSelect: number; products: number; options: { id?: string; name: string; priceDelta: number; available: boolean }[] };

export function MenuAdmin({ tab, canManage, stations, categories, products, groups }: {
  tab: "productos" | "categorias" | "opciones"; canManage: boolean; stations: { id: string; name: string }[]; categories: Cat[]; products: Prod[]; groups: Group[];
}) {
  useLiveRefresh(["menu.changed"]);
  const router = useRouter();
  const [q, setQ] = useState("");
  const [bulk, setBulk] = useState(false);
  const tabs = [
    { key: "productos", label: `Productos (${products.length})` },
    { key: "categorias", label: `Categorías (${categories.length})` },
    { key: "opciones", label: `Opciones (${groups.length})` },
  ] as const;

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Carta"
        action={
          canManage && tab === "productos" ? (
            <>
              <Link href="/carta/nuevo" className="h-10 px-4 rounded-2xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nuevo producto</Link>
              <Button variant="outline" size="sm" icon={<Percent className="w-4 h-4" />} onClick={() => setBulk(true)}>Actualizar precios</Button>
            </>
          ) : undefined
        }
      />
      {canManage && (
        <div className="flex gap-1 border-b border-border mb-4">
          {tabs.map((t) => (
            <button key={t.key} onClick={() => router.push(`/carta?tab=${t.key}`)} className={cn("h-11 px-4 text-sm font-semibold border-b-2 -mb-px", tab === t.key ? "border-accent text-accent" : "border-transparent text-text-secondary hover:text-text-primary")}>
              {t.label}
            </button>
          ))}
        </div>
      )}
      {tab === "productos" && <Products q={q} setQ={setQ} categories={categories} products={products} canManage={canManage} />}
      {tab === "categorias" && canManage && <Categories categories={categories} stations={stations} />}
      {tab === "opciones" && canManage && <Groups groups={groups} />}
      {bulk && <BulkPrice categories={categories} onClose={() => setBulk(false)} />}
    </PageContainer>
  );
}

function Products({ q, setQ, categories, products, canManage }: { q: string; setQ: (s: string) => void; categories: Cat[]; products: Prod[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const term = q.trim().toLowerCase();
  const filtered = useMemo(() => products.filter((p) => !term || p.name.toLowerCase().includes(term)), [products, term]);
  const groups = [...categories.map((c) => ({ id: c.id as string | null, name: c.name, color: c.color })), { id: null, name: "Sin categoría", color: "neutral" }];

  async function toggle(p: Prod, available: boolean) {
    try {
      await api(`/api/products/${p.id}/availability`, { body: { available } });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto" className="w-full h-11 pl-9 pr-3 rounded-2xl border border-border bg-surface text-base lg:text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20" />
      </div>
      {groups.map((g) => {
        const list = filtered.filter((p) => p.categoryId === g.id);
        if (!list.length) return null;
        return (
          <div key={g.id ?? "none"} className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-surface-secondary">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: solidColor(g.color) }} />
              <p className="text-sm font-semibold text-text-primary flex-1">{g.name}</p>
              {canManage && g.id && <Link href={`/carta/nuevo?categoria=${g.id}`} className="text-xs font-semibold text-accent hover:underline">Agregar</Link>}
            </div>
            <div className="divide-y divide-border">
              {list.map((p) => {
                const margin = p.price > 0 && p.cost > 0 ? ((p.price - p.cost) / p.price) * 100 : null;
                const row = (
                  <>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium truncate", p.available ? "text-text-primary" : "text-text-muted line-through")}>{p.name}</p>
                      <p className="text-xs text-text-muted truncate">
                        {p.station ?? "Sin estación"}{margin !== null ? ` · margen ${formatPercent(margin, 0)}` : ""}{!p.showInQrMenu ? " · oculto en QR" : ""}
                      </p>
                    </div>
                    {!p.available && <Badge tone="error">Sin stock</Badge>}
                    <span className="text-sm font-semibold tabular-nums w-28 text-right">{p.openPrice ? "Libre" : formatCurrency(p.price)}</span>
                  </>
                );
                return (
                  <div key={p.id} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-secondary/60">
                    {canManage ? (
                      <Link href={`/carta/${p.id}`} className="flex flex-1 min-w-0 items-center gap-3">{row}<ChevronRight className="w-4 h-4 text-text-muted shrink-0" /></Link>
                    ) : (
                      <div className="flex flex-1 min-w-0 items-center gap-3">{row}</div>
                    )}
                    <Switch checked={p.available} onChange={(v) => toggle(p, v)} label={`${p.name} disponible`} />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {filtered.length === 0 && <p className="text-sm text-text-secondary py-6 text-center">{term ? "No hay productos con ese nombre." : "Todavía no hay productos."}</p>}
    </div>
  );
}

function Categories({ categories, stations }: { categories: Cat[]; stations: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  async function call(fn: () => Promise<unknown>) {
    try {
      await fn();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <div className="space-y-3 max-w-3xl">
      <p className="text-sm text-text-secondary">La estación de la categoría dice a qué pantalla o comandera va cada plato. Un producto puede tener la suya propia.</p>
      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {categories.map((c, i) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5">
            <div className="flex flex-col">
              <button disabled={i === 0} onClick={() => call(async () => { await api(`/api/categories/${c.id}`, { method: "PATCH", body: { sort: i - 1 } }); await api(`/api/categories/${categories[i - 1]!.id}`, { method: "PATCH", body: { sort: i } }); })} className="w-7 h-5 flex items-center justify-center text-text-muted disabled:opacity-30" aria-label="Subir"><ArrowUp className="w-3.5 h-3.5" /></button>
              <button disabled={i === categories.length - 1} onClick={() => call(async () => { await api(`/api/categories/${c.id}`, { method: "PATCH", body: { sort: i + 1 } }); await api(`/api/categories/${categories[i + 1]!.id}`, { method: "PATCH", body: { sort: i } }); })} className="w-7 h-5 flex items-center justify-center text-text-muted disabled:opacity-30" aria-label="Bajar"><ArrowDown className="w-3.5 h-3.5" /></button>
            </div>
            <input defaultValue={c.name} onBlur={(e) => e.target.value.trim() && e.target.value !== c.name && call(() => api(`/api/categories/${c.id}`, { method: "PATCH", body: { name: e.target.value.trim() } }))} className="flex-1 min-w-32 h-10 px-3 rounded-xl border border-transparent hover:border-border focus:border-accent bg-transparent text-sm font-semibold outline-none" />
            <span className="text-xs text-text-muted w-20">{c.count} productos</span>
            <div className="w-36"><Select value={c.color} onChange={(e) => call(() => api(`/api/categories/${c.id}`, { method: "PATCH", body: { color: e.target.value } }))} options={COLOR_OPTIONS.map((o) => ({ value: o, label: COLOR_LABEL[o] }))} /></div>
            <div className="w-40"><Select value={c.stationId ?? ""} placeholder="Sin estación" onChange={(e) => call(() => api(`/api/categories/${c.id}`, { method: "PATCH", body: { stationId: e.target.value || null } }))} options={stations.map((s) => ({ value: s.id, label: s.name }))} /></div>
            <button onClick={() => call(() => api(`/api/categories/${c.id}`, { method: "DELETE" }))} className="tap-44 flex items-center justify-center rounded-xl text-text-muted hover:text-error hover:bg-error-subtle" aria-label="Borrar categoría"><Trash2 className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
      <form onSubmit={(e) => { e.preventDefault(); if (name.trim()) call(() => api("/api/categories", { body: { name: name.trim() } })).then(() => setName("")); }} className="flex gap-2 max-w-md">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nueva categoría" />
        <Button type="submit" icon={<Plus className="w-4 h-4" />}>Agregar</Button>
      </form>
    </div>
  );
}

function Groups({ groups }: { groups: Group[] }) {
  const [edit, setEdit] = useState<Group | null>(null);
  return (
    <div className="space-y-3 max-w-3xl">
      <p className="text-sm text-text-secondary">Grupos de opciones que se eligen al cargar un plato: punto de la carne, guarnición, extras con precio, "sin…".</p>
      <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
        {groups.map((g) => (
          <button key={g.id} onClick={() => setEdit(g)} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-surface-secondary">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">{g.name}</p>
              <p className="text-xs text-text-muted truncate">{g.options.map((o) => o.name).join(", ")}</p>
            </div>
            <span className="text-xs text-text-muted">{g.minSelect > 0 ? "Obligatorio" : "Opcional"} · {g.products} productos</span>
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </button>
        ))}
      </div>
      <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => setEdit({ id: "", name: "", minSelect: 0, maxSelect: 1, products: 0, options: [{ name: "", priceDelta: 0, available: true }] })}>Nuevo grupo</Button>
      {edit && <GroupSheet group={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function GroupSheet({ group, onClose }: { group: Group; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [g, setG] = useState(group);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const body = { name: g.name, minSelect: g.minSelect, maxSelect: g.maxSelect, options: g.options.filter((o) => o.name.trim()) };
      if (g.id) await api(`/api/modifier-groups/${g.id}`, { method: "PUT", body });
      else await api("/api/modifier-groups", { body });
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }
  async function remove() {
    try {
      await api(`/api/modifier-groups/${g.id}`, { method: "DELETE" });
      router.refresh();
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <Sheet open onClose={onClose} title={g.id ? g.name : "Nuevo grupo de opciones"} maxWidth="max-w-lg"
      footer={<div className="flex gap-2">{g.id && <Button variant="danger-outline" onClick={remove} icon={<Trash2 className="w-4 h-4" />}>Borrar</Button>}<Button className="flex-1" loading={busy} disabled={!g.name.trim()} onClick={save}>Guardar</Button></div>}
    >
      <div className="space-y-4">
        <Input label="Nombre" value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Guarnición, Punto, Extras…" />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Mínimo a elegir" type="number" min={0} value={g.minSelect} onChange={(e) => setG({ ...g, minSelect: Math.max(0, Number(e.target.value) || 0) })} hint="1 = obligatorio" />
          <Input label="Máximo" type="number" min={0} value={g.maxSelect} onChange={(e) => setG({ ...g, maxSelect: Math.max(0, Number(e.target.value) || 0) })} hint="0 = sin límite" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Opciones</p>
          {g.options.map((o, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={o.name} onChange={(e) => setG({ ...g, options: g.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder="Opción" />
              <div className="w-32 shrink-0"><CurrencyInput value={o.priceDelta} onChange={(v) => setG({ ...g, options: g.options.map((x, j) => (j === i ? { ...x, priceDelta: v ?? 0 } : x)) })} /></div>
              <Switch checked={o.available} onChange={(v) => setG({ ...g, options: g.options.map((x, j) => (j === i ? { ...x, available: v } : x)) })} label="Disponible" />
              <button onClick={() => setG({ ...g, options: g.options.filter((_, j) => j !== i) })} className="tap-44 flex items-center justify-center rounded-xl text-text-muted hover:bg-surface-secondary" aria-label="Quitar opción"><X className="w-4 h-4" /></button>
            </div>
          ))}
          <Button variant="outline" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setG({ ...g, options: [...g.options, { name: "", priceDelta: 0, available: true }] })}>Opción</Button>
        </div>
      </div>
    </Sheet>
  );
}

function BulkPrice({ categories, onClose }: { categories: Cat[]; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [pct, setPct] = useState(10);
  const [cats, setCats] = useState<string[]>([]);
  const [roundTo, setRoundTo] = useState(100);
  const [preview, setPreview] = useState<{ name: string; from: number; to: number }[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(dryRun: boolean) {
    setBusy(true);
    try {
      const r = await api<{ changes: { name: string; from: number; to: number }[] }>("/api/products/bulk-price", { body: { pct, categoryIds: cats, roundTo, dryRun } });
      if (dryRun) setPreview(r.changes);
      else {
        toast.success(`Se actualizaron ${r.changes.length} precios`);
        router.refresh();
        onClose();
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Actualizar precios" description="Subí (o bajá) un porcentaje toda la carta o algunas categorías, con redondeo." maxWidth="max-w-lg"
      footer={preview ? <Button fullWidth loading={busy} onClick={() => run(false)}>Aplicar a {preview.length} productos</Button> : <Button fullWidth loading={busy} onClick={() => run(true)}>Ver cómo quedan</Button>}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Porcentaje" type="number" value={pct} onChange={(e) => { setPct(Number(e.target.value) || 0); setPreview(null); }} hint="Negativo para bajar" />
          <Select label="Redondear a" value={String(roundTo)} onChange={(e) => { setRoundTo(Number(e.target.value)); setPreview(null); }} options={[{ value: "0", label: "Sin redondeo" }, { value: "10", label: "$ 10" }, { value: "50", label: "$ 50" }, { value: "100", label: "$ 100" }, { value: "500", label: "$ 500" }]} />
        </div>
        <div>
          <p className="text-sm font-medium mb-1.5">Categorías <span className="text-text-muted font-normal">(ninguna = toda la carta)</span></p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = cats.includes(c.id);
              return (
                <button key={c.id} onClick={() => { setCats(on ? cats.filter((x) => x !== c.id) : [...cats, c.id]); setPreview(null); }} className={cn("h-9 px-3 rounded-xl border text-xs font-semibold", on ? "border-accent bg-accent-light text-accent" : "border-border text-text-secondary")}>{c.name}</button>
              );
            })}
          </div>
        </div>
        {preview && (
          <div className="rounded-2xl border border-border divide-y divide-border max-h-64 overflow-y-auto scroll-contain">
            {preview.map((c) => (
              <div key={c.name} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                <span className="truncate">{c.name}</span>
                <span className="tabular-nums whitespace-nowrap text-text-muted">{formatCurrency(c.from)} → <b className="text-text-primary">{formatCurrency(c.to)}</b></span>
              </div>
            ))}
            {preview.length === 0 && <p className="px-3 py-2 text-sm text-text-secondary">No cambia ningún precio.</p>}
          </div>
        )}
      </div>
    </Sheet>
  );
}
