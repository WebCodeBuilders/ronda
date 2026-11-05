"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight, Lock, LockOpen, Wallet, ChevronRight, Calculator } from "lucide-react";
import { Button, CurrencyInput, Input, Sheet, tableCls } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatList, StatRow } from "@/components/shared/StatList";
import { useToast } from "@/components/ui/Toast";
import { useLiveRefresh } from "@/lib/realtime/client";
import { api } from "@/lib/client/api";
import type { CashSummary } from "@/lib/cash";
import { formatCurrency, formatDate, formatTime, formatDuration, cn, round2 } from "@/lib/utils";

const BILLS = [20000, 10000, 2000, 1000, 500, 200, 100, 50, 20, 10];

export function CashView({ summary, isOpen, openOrders, history }: {
  summary: CashSummary | null; isOpen: boolean; hasOpen: boolean; openOrders: number;
  history: { id: string; openedAt: string; closedAt: string; openedBy: string; sales: number; difference: number }[];
}) {
  useLiveRefresh(["cash.changed", "order.changed"]);
  const router = useRouter();
  const toast = useToast();
  const [opening, setOpening] = useState<number | null>(null);
  const [panel, setPanel] = useState<null | "IN" | "OUT" | "close">(null);
  const [busy, setBusy] = useState(false);

  async function openCash() {
    setBusy(true);
    try {
      await api("/api/cash/open", { body: { openingAmount: opening ?? 0 } });
      toast.success("Caja abierta");
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Caja"
        back={!isOpen && summary ? { href: "/caja", label: "Caja actual" } : undefined}
        meta={summary ? <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", summary.session.closedAt ? "bg-surface-secondary text-text-secondary" : "bg-success-light text-success-strong")}>{summary.session.closedAt ? "Cerrada" : "Abierta"}</span> : null}
        action={
          isOpen ? (
            <>
              <Button variant="outline" size="sm" icon={<ArrowDownLeft className="w-4 h-4" />} onClick={() => setPanel("IN")}>Ingreso</Button>
              <Button variant="outline" size="sm" icon={<ArrowUpRight className="w-4 h-4" />} onClick={() => setPanel("OUT")}>Retiro</Button>
              <Button size="sm" icon={<Lock className="w-4 h-4" />} onClick={() => setPanel("close")}>Cerrar caja</Button>
            </>
          ) : null
        }
      />

      {!summary && (
        <div className="rounded-2xl border border-border bg-surface p-6 max-w-md">
          <div className="w-12 h-12 rounded-2xl bg-accent-light text-accent flex items-center justify-center mb-3"><Wallet className="w-6 h-6" /></div>
          <h2 className="text-base font-semibold text-text-primary">La caja está cerrada</h2>
          <p className="text-sm text-text-secondary mt-1 mb-4">Abrila con el fondo de cambio para empezar a cobrar.</p>
          <p className="text-sm font-medium mb-1.5">Fondo inicial (efectivo en el cajón)</p>
          <CurrencyInput value={opening} onChange={setOpening} placeholder="0" />
          <Button className="mt-4" fullWidth loading={busy} onClick={openCash} icon={<LockOpen className="w-4 h-4" />}>Abrir caja</Button>
        </div>
      )}

      {summary && (
        <div className="grid gap-3 lg:gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-3 lg:space-y-4">
            <StatList title="Turno">
              <StatRow label="Abrió" value={summary.session.openedBy} sub={formatDate(summary.session.openedAt)} />
              {summary.session.closedAt && <StatRow label="Cerró" value={summary.session.closedBy ?? "—"} sub={formatDate(summary.session.closedAt)} />}
              <StatRow label="Duración" value={formatDuration(summary.session.openedAt, summary.session.closedAt)} />
              <StatRow label="Cobros" value={String(summary.totals.count)} />
            </StatList>
            <StatList title="Ventas por medio de pago">
              {summary.methods.length === 0 && <StatRow label="Sin cobros todavía" value="—" />}
              {summary.methods.map((m) => (
                <StatRow key={m.name} label={`${m.name} (${m.count})`} value={formatCurrency(m.amount + m.surcharge)} sub={m.tips ? `+ ${formatCurrency(m.tips)} propina` : undefined} />
              ))}
              <StatRow label="Total vendido" value={formatCurrency(summary.totals.sales)} color="var(--success-strong)" />
              <StatRow label="Propinas" value={formatCurrency(summary.totals.tips)} />
              {summary.totals.surcharges !== 0 && <StatRow label="Recargos" value={formatCurrency(summary.totals.surcharges)} />}
            </StatList>
            <StatList title="Efectivo en el cajón">
              <StatRow label="Fondo inicial" value={formatCurrency(summary.session.openingAmount)} />
              <StatRow label="Cobrado en efectivo" value={formatCurrency(summary.totals.cashPayments)} />
              <StatRow label="Ingresos" value={formatCurrency(summary.totals.ins)} />
              <StatRow label="Retiros" value={`−${formatCurrency(summary.totals.outs)}`} />
              <StatRow label="Debería haber" value={formatCurrency(summary.totals.expectedCash)} color="var(--accent)" />
              {summary.session.countedCash !== null && <StatRow label="Se contó" value={formatCurrency(summary.session.countedCash)} />}
              {summary.session.difference !== null && (
                <StatRow label="Diferencia" value={formatCurrency(summary.session.difference)} color={Math.abs(summary.session.difference) < 0.01 ? "var(--success-strong)" : "var(--error)"} />
              )}
            </StatList>
          </div>

          <div className="space-y-3 lg:space-y-4 min-w-0">
            {summary.movements.length > 0 && (
              <div className={tableCls.frame}>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Ingresos y retiros</p>
                <table className={tableCls.table}>
                  <tbody>
                    {summary.movements.map((m) => (
                      <tr key={m.id} className={tableCls.tr}>
                        <td className={tableCls.td}>{formatTime(m.createdAt)}</td>
                        <td className={tableCls.td}>{m.reason}<div className={tableCls.sub}>{m.user}</div></td>
                        <td className={cn(tableCls.td, tableCls.tdRight, m.kind === "OUT" ? "text-error" : "text-success-strong")}>{m.kind === "OUT" ? "−" : "+"}{formatCurrency(m.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className={tableCls.frame}>
              <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Cobros del turno</p>
              {summary.payments.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-text-secondary">Todavía no hay cobros.</p>
              ) : (
                <div className={tableCls.scroll}>
                  <table className={tableCls.table}>
                    <thead className={tableCls.thead}>
                      <tr>
                        <th className={tableCls.th}>Hora</th>
                        <th className={tableCls.th}>Pedido</th>
                        <th className={tableCls.th}>Medio</th>
                        <th className={cn(tableCls.th, tableCls.thRight)}>Propina</th>
                        <th className={cn(tableCls.th, tableCls.thRight)}>Importe</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.payments.map((p) => (
                        <tr key={p.id} className={cn(tableCls.tr, p.orderId && tableCls.trClickable)} onClick={() => p.orderId && router.push(`/pedidos/${p.orderId}`)}>
                          <td className={cn(tableCls.td, "tabular-nums")}>{formatTime(p.createdAt)}</td>
                          <td className={tableCls.td}>{p.orderLabel}<div className={tableCls.sub}>{p.by}{p.reference ? ` · ${p.reference}` : ""}</div></td>
                          <td className={tableCls.td}>{p.method}</td>
                          <td className={cn(tableCls.td, tableCls.tdRight, tableCls.tdMuted)}>{p.tip ? formatCurrency(p.tip) : "—"}</td>
                          <td className={cn(tableCls.td, tableCls.tdRight, "font-semibold", p.amount < 0 && "text-error")}>{formatCurrency(p.amount + p.surcharge)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {history.length > 0 && (
        <div className="mt-4 lg:mt-6">
          <h2 className="text-sm font-semibold text-text-primary mb-2">Cierres anteriores</h2>
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {history.map((h) => (
              <Link key={h.id} href={`/caja?turno=${h.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-secondary">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">{formatDate(h.openedAt)} → {formatTime(h.closedAt)}</p>
                  <p className="text-xs text-text-muted">{h.openedBy}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(h.sales)}</p>
                  <p className={cn("text-xs tabular-nums", Math.abs(h.difference) < 0.01 ? "text-success-strong" : "text-error")}>{Math.abs(h.difference) < 0.01 ? "Cerró justo" : `Diferencia ${formatCurrency(h.difference)}`}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {(panel === "IN" || panel === "OUT") && <MovementSheet kind={panel} onClose={() => setPanel(null)} onDone={() => { setPanel(null); router.refresh(); }} />}
      {panel === "close" && summary && <CloseSheet summary={summary} openOrders={openOrders} onClose={() => setPanel(null)} />}
    </PageContainer>
  );
}

function MovementSheet({ kind, onClose, onDone }: { kind: "IN" | "OUT"; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [amount, setAmount] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const presets = kind === "OUT" ? ["Pago a proveedor", "Retiro del dueño", "Propinas a mozos", "Compra de insumos"] : ["Cambio", "Aporte del dueño"];
  async function save() {
    setBusy(true);
    try {
      await api("/api/cash/movement", { body: { kind, amount, reason } });
      toast.success(kind === "IN" ? "Ingreso registrado" : "Retiro registrado");
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Sheet open onClose={onClose} title={kind === "IN" ? "Ingreso de efectivo" : "Retiro de efectivo"} maxWidth="max-w-sm" footer={<Button fullWidth loading={busy} disabled={!amount || !reason.trim()} onClick={save}>Registrar</Button>}>
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium mb-1.5">Importe</p>
          <CurrencyInput value={amount} onChange={setAmount} autoFocus />
        </div>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p} onClick={() => setReason(p)} className={cn("h-9 px-3 rounded-xl border text-xs font-medium", reason === p ? "border-accent bg-accent-light text-accent" : "border-border text-text-secondary")}>{p}</button>
          ))}
        </div>
        <Input label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
      </div>
    </Sheet>
  );
}

function CloseSheet({ summary, openOrders, onClose }: { summary: CashSummary; openOrders: number; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [manual, setManual] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const fromBills = round2(BILLS.reduce((s, b) => s + b * (counts[b] ?? 0), 0));
  const counted = manual ?? fromBills;
  const diff = round2(counted - summary.totals.expectedCash);

  async function close() {
    setBusy(true);
    try {
      const r = await api<{ difference: number; jobId: string; browserPrint: boolean }>("/api/cash/close", { body: { countedCash: counted, notes: notes || null } });
      if (r.browserPrint) window.open(`/imprimir/${r.jobId}`, "_blank", "width=420,height=700");
      toast.success("Caja cerrada", Math.abs(r.difference) < 0.01 ? "Cerró justo." : `Diferencia: ${formatCurrency(r.difference)}`);
      onClose();
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title="Cerrar caja" description={`Debería haber ${formatCurrency(summary.totals.expectedCash)} en efectivo.`} maxWidth="max-w-md"
      footer={<Button fullWidth loading={busy} onClick={close} icon={<Lock className="w-4 h-4" />}>Cerrar con {formatCurrency(counted)}</Button>}
    >
      <div className="space-y-4">
        {openOrders > 0 && <p className="text-sm rounded-2xl bg-warning-subtle text-warning-strong px-3 py-2">Hay {openOrders} {openOrders === 1 ? "pedido abierto" : "pedidos abiertos"}. Se pueden cobrar en el próximo turno.</p>}
        <div>
          <p className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Calculator className="w-4 h-4" /> Contá los billetes</p>
          <div className="grid grid-cols-2 gap-2">
            {BILLS.map((b) => (
              <label key={b} className="flex items-center gap-2 rounded-xl border border-border px-3 h-11">
                <span className="text-sm tabular-nums w-20 text-text-secondary">{formatCurrency(b).replace(",00", "")}</span>
                <span className="text-text-muted">×</span>
                <input type="number" min={0} inputMode="numeric" value={counts[b] ?? ""} onChange={(e) => { setManual(null); setCounts((c) => ({ ...c, [b]: Math.max(0, Number(e.target.value) || 0) })); }} className="w-full bg-transparent text-base lg:text-sm text-right tabular-nums outline-none" />
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-1.5">O el total contado</p>
          <CurrencyInput value={manual} onChange={setManual} placeholder={formatCurrency(fromBills)} />
        </div>
        <div className={cn("rounded-2xl px-3 py-2.5 text-sm font-semibold flex justify-between", Math.abs(diff) < 0.01 ? "bg-success-subtle text-success-strong" : diff < 0 ? "bg-error-subtle text-error-strong" : "bg-warning-subtle text-warning-strong")}>
          <span>{Math.abs(diff) < 0.01 ? "Cierra justo" : diff < 0 ? "Falta" : "Sobra"}</span>
          <span className="tabular-nums">{formatCurrency(Math.abs(diff))}</span>
        </div>
        <Input label="Nota (opcional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
    </Sheet>
  );
}
