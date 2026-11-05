"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, MessageCircle } from "lucide-react";
import { Badge, Button, CurrencyInput, Input, Select, Sheet, Textarea } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatList, StatRow } from "@/components/shared/StatList";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE, ORDER_TYPE_LABEL } from "@/lib/orders/labels";
import { formatCurrency, formatDate, formatDay, formatQty } from "@/lib/utils";

type C = { id: string; name: string; phone: string; email: string; address: string; addressNotes: string; notes: string; birthday: string; creditLimit: number; tags: string[]; balance: number; points: number };

export function CustomerDetail({ customer, stats, favorites, orders, movements, methods, canCharge }: {
  customer: C; stats: { visits: number; spent: number; avg: number; last: string | null }; favorites: { name: string; quantity: number }[];
  orders: { id: string; number: number; type: string; status: string; total: number; openedAt: string; table: string | null }[];
  movements: { id: string; method: string; kind: string; amount: number; createdAt: string; orderId: string | null }[];
  methods: { id: string; name: string }[]; canCharge: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [c, setC] = useState(customer);
  const [pay, setPay] = useState(false);
  const [amount, setAmount] = useState<number | null>(customer.balance || null);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof C>(k: K, v: C[K]) => setC((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      await api(`/api/customers/${c.id}`, { method: "PUT", body: { name: c.name, phone: c.phone, email: c.email, address: c.address, addressNotes: c.addressNotes, notes: c.notes, birthday: c.birthday || null, creditLimit: c.creditLimit, tags: c.tags } });
      toast.success("Guardado");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function registerPayment() {
    try {
      await api(`/api/customers/${c.id}/payment`, { body: { methodId, amount } });
      toast.success("Pago registrado");
      setPay(false);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const wa = c.phone ? `https://wa.me/${(c.phone.replace(/\D/g, "").startsWith("54") ? "" : "549") + c.phone.replace(/\D/g, "").replace(/^0/, "")}` : null;

  return (
    <PageContainer width="wide">
      <PageHeader title={customer.name} back={{ href: "/clientes", label: "Clientes" }} meta={customer.tags.map((t) => <Badge key={t} tone="violet">{t}</Badge>)}
        action={<>{wa && <a href={wa} target="_blank" rel="noreferrer" className="h-10 px-3 rounded-xl border border-border bg-surface text-sm font-semibold text-success-strong flex items-center gap-1.5"><MessageCircle className="w-4 h-4" /> WhatsApp</a>}{canCharge && customer.balance > 0 && <Button size="sm" onClick={() => setPay(true)}>Registrar pago</Button>}</>}
      />
      <div className="grid gap-3 lg:gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <div className="space-y-3 lg:space-y-4">
          <StatList title="Resumen">
            <StatRow label="Visitas" value={String(stats.visits)} sub={stats.last ? `Última: ${formatDay(stats.last)}` : undefined} />
            <StatRow label="Consumió en total" value={formatCurrency(stats.spent)} />
            <StatRow label="Ticket promedio" value={formatCurrency(stats.avg)} />
            <StatRow label="Puntos" value={String(customer.points)} />
            <StatRow label="Cuenta corriente" value={customer.balance > 0 ? `Debe ${formatCurrency(customer.balance)}` : "Al día"} color={customer.balance > 0 ? "var(--error)" : "var(--success-strong)"} sub={customer.creditLimit ? `Límite ${formatCurrency(customer.creditLimit)}` : undefined} />
          </StatList>
          {favorites.length > 0 && (
            <StatList title="Lo que más pide">
              {favorites.map((f) => <StatRow key={f.name} label={f.name} value={formatQty(f.quantity)} />)}
            </StatList>
          )}
          <div className="rounded-2xl border border-border bg-surface p-4 space-y-3">
            <h2 className="text-sm font-semibold text-text-primary">Datos</h2>
            <Input label="Nombre" value={c.name} onChange={(e) => set("name", e.target.value)} />
            <Input label="Teléfono" value={c.phone} onChange={(e) => set("phone", e.target.value)} />
            <Input label="Email" value={c.email} onChange={(e) => set("email", e.target.value)} />
            <Input label="Dirección" value={c.address} onChange={(e) => set("address", e.target.value)} />
            <Input label="Indicaciones" value={c.addressNotes} onChange={(e) => set("addressNotes", e.target.value)} placeholder="Timbre, piso, entre calles" />
            <Input label="Cumpleaños" type="date" value={c.birthday} onChange={(e) => set("birthday", e.target.value)} />
            <Textarea label="Notas (las ve el mozo en la mesa)" rows={2} value={c.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Alergias, mesa favorita…" />
            <div>
              <p className="text-sm font-medium mb-1.5">Límite de cuenta corriente</p>
              <CurrencyInput value={c.creditLimit} onChange={(v) => set("creditLimit", v ?? 0)} />
            </div>
            <Input label="Etiquetas (separadas por coma)" value={c.tags.join(", ")} onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))} />
            <Button fullWidth loading={busy} onClick={save}>Guardar</Button>
          </div>
        </div>
        <div className="space-y-3 lg:space-y-4 min-w-0">
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Pedidos</p>
            {orders.length === 0 && <p className="px-4 pb-4 text-sm text-text-secondary">Todavía no tiene pedidos.</p>}
            {orders.map((o) => (
              <Link key={o.id} href={`/pedidos/${o.id}`} className="flex items-center gap-3 border-t border-border px-4 py-2.5 hover:bg-surface-secondary">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary">#{o.number} · {o.table ? `Mesa ${o.table}` : ORDER_TYPE_LABEL[o.type]}</p>
                  <p className="text-xs text-text-muted">{formatDate(o.openedAt)}</p>
                </div>
                <Badge tone={ORDER_STATUS_TONE[o.status]}>{ORDER_STATUS_LABEL[o.status]}</Badge>
                <span className="text-sm font-semibold tabular-nums w-28 text-right">{formatCurrency(o.total)}</span>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </Link>
            ))}
          </div>
          {movements.length > 0 && (
            <div className="rounded-2xl border border-border bg-surface overflow-hidden">
              <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Pagos</p>
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between border-t border-border px-4 py-2.5 text-sm">
                  <span className="text-text-secondary">{formatDate(m.createdAt)} · {m.method}{m.kind === "ACCOUNT" ? " (a cuenta)" : m.orderId ? "" : " · pago de deuda"}</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(m.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Sheet open={pay} onClose={() => setPay(false)} title="Pago de cuenta corriente" description={`Debe ${formatCurrency(customer.balance)}`} maxWidth="max-w-sm" footer={<Button fullWidth disabled={!amount} onClick={registerPayment}>Registrar {amount ? formatCurrency(amount) : ""}</Button>}>
        <div className="space-y-3">
          <CurrencyInput value={amount} onChange={setAmount} />
          <Select label="Cómo paga" value={methodId} onChange={(e) => setMethodId(e.target.value)} options={methods.map((m) => ({ value: m.id, label: m.name }))} />
        </div>
      </Sheet>
    </PageContainer>
  );
}
