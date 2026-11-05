"use client";

import { useMemo, useState } from "react";
import { Banknote, CreditCard, Landmark, QrCode, BookUser, CircleDollarSign, Check, Users, ListChecks, Divide, UserRound } from "lucide-react";
import { Button, CurrencyInput, Sheet } from "@/components/ui";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";
import { methodAdjustment, remaining, splitEvenly } from "@/lib/orders/totals";
import type { OrderDetail } from "@/lib/orders/queries";
import { CustomerPicker, type PickedCustomer } from "@/components/customers/CustomerPicker";
import { formatCurrency, formatQty, round2, cn } from "@/lib/utils";

export type PayMethod = { id: string; name: string; kind: string; adjustPct: number };

const KIND_ICON: Record<string, typeof Banknote> = { CASH: Banknote, CARD: CreditCard, TRANSFER: Landmark, QR: QrCode, ACCOUNT: BookUser, OTHER: CircleDollarSign };

type Mode = "all" | "even" | "items" | "seat";

/**
 * Cobro. Se puede cobrar todo junto, en partes iguales, por lo que consumió
 * cada uno (ítems) o por comensal, y mezclar medios de pago. Cada parte se
 * registra en el momento: si se corta la luz a mitad, lo cobrado no se pierde.
 */
export function PaymentSheet({ order, methods, suggestedTipPct, onClose, onPaid }: {
  order: OrderDetail; methods: PayMethod[]; suggestedTipPct: number; onClose: () => void; onPaid: (closed: boolean) => void;
}) {
  const toast = useToast();
  const due = remaining(order.total, order.paidAmount);
  const [mode, setMode] = useState<Mode>("all");
  const [parts, setParts] = useState(Math.max(2, order.guests));
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [amount, setAmount] = useState<number | null>(due);
  const [tipPct, setTipPct] = useState<number | null>(null);
  const [tipCustom, setTipCustom] = useState<number | null>(null);
  const [tendered, setTendered] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<Record<string, number>>({});
  const [seat, setSeat] = useState<number | null>(null);
  const [customer, setCustomer] = useState<PickedCustomer | null>(order.customer ? { id: order.customer.id, name: order.customer.name, balance: order.customer.balance, creditLimit: order.customer.creditLimit } : null);
  const [busy, setBusy] = useState(false);

  const method = methods.find((m) => m.id === methodId);
  const payable = order.items.filter((i) => i.status !== "VOID" && i.quantity - i.paidQty > 0.0001);
  const seats = [...new Set(payable.map((i) => i.seat).filter((s): s is number => !!s))].sort((a, b) => a - b);

  // Proporción de los extras (cubierto, descuento, envío) para repartir al cobrar por ítems.
  const ratio = order.subtotal > 0 ? order.total / order.subtotal : 1;

  const itemsAmount = useMemo(() => {
    const base = Object.entries(selectedItems).reduce((s, [id, q]) => s + (order.items.find((i) => i.id === id)?.unitPrice ?? 0) * q, 0);
    return round2(Math.min(due, base * ratio));
  }, [selectedItems, order.items, ratio, due]);

  function pickMode(m: Mode) {
    setMode(m);
    setSelectedItems({});
    setSeat(null);
    if (m === "all") setAmount(due);
    if (m === "even") setAmount(splitEvenly(due, parts)[0] ?? due);
    if (m === "items" || m === "seat") setAmount(0);
  }

  function pickSeat(s: number) {
    setSeat(s);
    const sel: Record<string, number> = {};
    for (const i of payable) if (i.seat === s) sel[i.id] = round2(i.quantity - i.paidQty);
    // Lo compartido se reparte entre todos los comensales.
    const shared = payable.filter((i) => !i.seat).reduce((acc, i) => acc + i.unitPrice * (i.quantity - i.paidQty), 0);
    setSelectedItems(sel);
    const own = Object.entries(sel).reduce((acc, [id, q]) => acc + (order.items.find((i) => i.id === id)?.unitPrice ?? 0) * q, 0);
    setAmount(round2(Math.min(due, (own + shared / Math.max(1, order.guests)) * ratio)));
  }

  function toggleItem(id: string, max: number) {
    setSelectedItems((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = max;
      const base = Object.entries(next).reduce((acc, [iid, q]) => acc + (order.items.find((i) => i.id === iid)?.unitPrice ?? 0) * q, 0);
      setAmount(round2(Math.min(due, base * ratio)));
      return next;
    });
  }

  const amt = amount ?? 0;
  const tip = tipCustom !== null ? tipCustom : tipPct !== null ? Math.round((amt * tipPct) / 100 / 10) * 10 : 0;
  const surcharge = method ? methodAdjustment(amt, method.adjustPct) : 0;
  const charge = round2(amt + tip + surcharge);
  const change = method?.kind === "CASH" && tendered !== null ? round2(tendered - charge) : null;
  const invalid = !method || !(amt > 0) || amt > due + 0.01 || (change !== null && change < 0) || (method?.kind === "ACCOUNT" && !customer);

  async function pay() {
    if (!method) return;
    setBusy(true);
    try {
      const r = await api<{ closed: boolean; change: number }>(`/api/orders/${order.id}`, {
        body: {
          action: "pay",
          methodId: method.id,
          amount: amt,
          tip,
          tendered: method.kind === "CASH" && tendered !== null ? tendered : undefined,
          customerId: method.kind === "ACCOUNT" ? customer?.id : undefined,
          items: mode === "items" || mode === "seat" ? Object.entries(selectedItems).map(([itemId, quantity]) => ({ itemId, quantity })) : undefined,
        },
      });
      if (r.change > 0) toast.success(`Vuelto: ${formatCurrency(r.change)}`);
      onPaid(r.closed);
      if (!r.closed) {
        const left = round2(due - amt);
        toast.success(`Cobrado ${formatCurrency(charge)}`, `Falta ${formatCurrency(left)}`);
        setSelectedItems({});
        setTendered(null);
        setTipPct(null);
        setTipCustom(null);
        setAmount(mode === "even" ? Math.min(left, splitEvenly(due, parts)[0] ?? left) : mode === "all" ? left : 0);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const quickBills = useMemo(() => {
    const opts = new Set<number>([charge]);
    for (const b of [1000, 2000, 5000, 10000, 20000]) opts.add(Math.ceil(charge / b) * b);
    return [...opts].filter((n) => n >= charge).sort((a, b) => a - b).slice(0, 4);
  }, [charge]);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Cobrar"
      description={`Total ${formatCurrency(order.total)}${order.paidAmount > 0 ? ` · cobrado ${formatCurrency(order.paidAmount)}` : ""} · falta ${formatCurrency(due)}`}
      maxWidth="max-w-xl"
      footer={
        <Button fullWidth size="lg" loading={busy} disabled={invalid} onClick={pay} icon={<Check className="w-5 h-5" />}>
          {method ? `Cobrar ${formatCurrency(charge)} con ${method.name}` : "Elegí cómo paga"}
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-surface-secondary p-1">
          {([
            ["all", "Todo", CircleDollarSign],
            ["even", "Partes iguales", Divide],
            ["items", "Por ítems", ListChecks],
            ["seat", "Por persona", UserRound],
          ] as const).map(([m, label, Icon]) => (
            <button key={m} onClick={() => pickMode(m)} className={cn("flex flex-col items-center justify-center gap-1 rounded-xl py-2 text-xs font-semibold", mode === m ? "bg-surface text-accent shadow-sm" : "text-text-secondary")}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>

        {mode === "even" && (
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-border p-3">
            <span className="text-sm text-text-secondary flex items-center gap-2"><Users className="w-4 h-4" /> Dividir en</span>
            <div className="flex items-center gap-2">
              {[2, 3, 4, 5, 6].map((n) => (
                <button key={n} onClick={() => { setParts(n); setAmount(splitEvenly(due, n)[0] ?? due); }} className={cn("w-10 h-10 rounded-xl border text-sm font-semibold tabular-nums", parts === n ? "bg-accent text-white border-accent" : "border-border")}>
                  {n}
                </button>
              ))}
            </div>
            <span className="text-sm font-semibold tabular-nums">{formatCurrency(splitEvenly(due, parts)[0] ?? 0)} c/u</span>
          </div>
        )}

        {mode === "seat" && (
          seats.length === 0 ? (
            <p className="text-sm text-text-secondary rounded-2xl bg-surface-secondary p-3">Nadie tiene platos asignados por comensal. Al cargar, elegí el número de comensal en cada plato, o usá "Por ítems".</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {seats.map((s) => (
                <button key={s} onClick={() => pickSeat(s)} className={cn("h-11 px-4 rounded-xl border text-sm font-semibold", seat === s ? "bg-accent text-white border-accent" : "border-border")}>Comensal {s}</button>
              ))}
            </div>
          )
        )}

        {(mode === "items" || (mode === "seat" && seat !== null)) && (
          <div className="rounded-2xl border border-border divide-y divide-border max-h-56 overflow-y-auto scroll-contain">
            {payable.map((i) => {
              const left = round2(i.quantity - i.paidQty);
              const on = !!selectedItems[i.id];
              return (
                <button key={i.id} onClick={() => toggleItem(i.id, left)} className={cn("w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm", on && "bg-accent-subtle")}>
                  <span className={cn("w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0", on ? "bg-accent border-accent text-white" : "border-border-strong")}>{on && <Check className="w-3 h-3" strokeWidth={3} />}</span>
                  <span className="flex-1">{formatQty(left)}× {i.name}{i.seat ? <span className="text-xs text-violet-strong font-semibold"> P{i.seat}</span> : null}</span>
                  <span className="tabular-nums font-semibold">{formatCurrency(i.unitPrice * left)}</span>
                </button>
              );
            })}
            {mode === "items" && <p className="px-3 py-2 text-xs text-text-muted">Incluye la parte proporcional de cubiertos y descuentos: {formatCurrency(itemsAmount)}</p>}
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-text-primary mb-2">¿Cómo paga?</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {methods.map((m) => {
              const Icon = KIND_ICON[m.kind] ?? CircleDollarSign;
              return (
                <button key={m.id} onClick={() => setMethodId(m.id)} className={cn("min-h-14 px-3 py-2 rounded-2xl border text-left flex items-center gap-2.5 transition-colors", methodId === m.id ? "border-accent bg-accent-light text-accent" : "border-border text-text-primary hover:bg-surface-secondary")}>
                  <Icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm font-semibold leading-tight">
                    {m.name}
                    {m.adjustPct !== 0 && <span className="block text-[11px] font-medium text-text-muted">{m.adjustPct > 0 ? "+" : ""}{m.adjustPct} %</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {method?.kind === "ACCOUNT" && (
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Cliente</p>
            <CustomerPicker value={customer} onChange={setCustomer} />
            {customer && customer.creditLimit > 0 && (
              <p className="text-xs text-text-muted mt-1.5">Debe {formatCurrency(customer.balance)} · límite {formatCurrency(customer.creditLimit)}</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Importe</p>
            <CurrencyInput value={amount} onChange={setAmount} />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Propina</p>
            <div className="flex gap-1.5">
              {[0, suggestedTipPct, 15].filter((v, i, a) => a.indexOf(v) === i).map((p) => (
                <button key={p} onClick={() => { setTipPct(p); setTipCustom(null); }} className={cn("flex-1 h-11 rounded-xl border text-sm font-semibold", tipCustom === null && (tipPct ?? 0) === p ? "bg-accent-light text-accent border-accent" : "border-border text-text-secondary")}>
                  {p === 0 ? "No" : `${p}%`}
                </button>
              ))}
            </div>
          </div>
        </div>
        <CurrencyInput value={tipCustom} onChange={setTipCustom} placeholder="Otra propina (monto)" />

        {method?.kind === "CASH" && (
          <div>
            <p className="text-sm font-semibold text-text-primary mb-2">Con cuánto paga</p>
            <div className="flex flex-wrap gap-2 mb-2">
              {quickBills.map((b) => (
                <button key={b} onClick={() => setTendered(b)} className={cn("h-10 px-3 rounded-xl border text-sm font-semibold tabular-nums", tendered === b ? "bg-accent-light text-accent border-accent" : "border-border")}>
                  {b === charge ? "Justo" : formatCurrency(b)}
                </button>
              ))}
            </div>
            <CurrencyInput value={tendered} onChange={setTendered} placeholder="Otro monto" />
            {change !== null && (
              <p className={cn("mt-2 text-lg font-bold tabular-nums", change < 0 ? "text-error" : "text-success-strong")}>
                {change < 0 ? `Faltan ${formatCurrency(-change)}` : `Vuelto ${formatCurrency(change)}`}
              </p>
            )}
          </div>
        )}

        <div className="rounded-2xl bg-surface-secondary p-3 text-sm space-y-1">
          <div className="flex justify-between"><span className="text-text-secondary">Importe</span><span className="tabular-nums">{formatCurrency(amt)}</span></div>
          {tip > 0 && <div className="flex justify-between"><span className="text-text-secondary">Propina</span><span className="tabular-nums">{formatCurrency(tip)}</span></div>}
          {surcharge !== 0 && <div className="flex justify-between"><span className="text-text-secondary">{surcharge > 0 ? "Recargo" : "Descuento"} {method?.name}</span><span className="tabular-nums">{formatCurrency(surcharge)}</span></div>}
          <div className="flex justify-between font-semibold pt-1"><span>A cobrar</span><span className="tabular-nums">{formatCurrency(charge)}</span></div>
          {amt < due - 0.009 && amt > 0 && <p className="text-xs text-text-muted pt-1">Queda {formatCurrency(due - amt)} por cobrar en esta cuenta.</p>}
        </div>
      </div>
    </Sheet>
  );
}
