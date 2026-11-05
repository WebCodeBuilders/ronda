"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatList, StatRow } from "@/components/shared/StatList";
import { GraficoDeBarras } from "@/components/charts/Chart";
import { useLiveRefresh } from "@/lib/realtime/client";
import type { SalesReport } from "@/lib/reports";
import { ORDER_TYPE_LABEL } from "@/lib/orders/labels";
import { formatCurrency, formatCurrencyCompact, formatPercent, formatQty, formatTime, cn } from "@/lib/utils";

type Live = { openOrders: number; openTotal: number; busyTables: number; tables: number; guests: number; kitchen: number; late: number; waitlist: number; printFails: number; cashOpen: boolean };

function delta(now: number, before: number) {
  if (!before) return null;
  return ((now - before) / before) * 100;
}

/**
 * Inicio del dueño y del encargado: cómo viene el día, comparado con el mismo
 * día de la semana pasada a esta misma hora, y lo que necesita atención.
 */
export function HomeDashboard({ userName, today, lastWeek, live, lowStock, reservations }: {
  userName: string; today: SalesReport; lastWeek: SalesReport["totals"]; live: Live;
  lowStock: { id: string; name: string; stock: number; minStock: number; unit: string }[];
  reservations: { id: string; name: string; partySize: number; dateTime: string; table: string | null; notes: string | null }[];
}) {
  useLiveRefresh(["order.changed", "cash.changed", "kitchen.changed", "tables.changed"], 60_000);
  const d = delta(today.totals.total, lastWeek.total);
  const firstHour = today.byHour.findIndex((h) => h.orders > 0);
  const hours = today.byHour.filter((h, i) => i >= Math.min(firstHour < 0 ? 11 : firstHour, 11)).map((h) => ({ hora: `${h.hour}h`, total: h.total }));
  const alerts = [
    !live.cashOpen && { text: "La caja está cerrada: no se puede cobrar.", href: "/caja", tone: "error" as const },
    live.late > 0 && { text: `${live.late} ${live.late === 1 ? "comanda demorada" : "comandas demoradas"} en cocina.`, href: "/cocina", tone: "error" as const },
    live.printFails > 0 && { text: `${live.printFails} ${live.printFails === 1 ? "impresión falló" : "impresiones fallaron"} hoy. Revisá las comanderas.`, href: "/configuracion/estaciones", tone: "warning" as const },
    lowStock.length > 0 && { text: `${lowStock.length} ${lowStock.length === 1 ? "insumo" : "insumos"} por debajo del mínimo.`, href: "/insumos", tone: "warning" as const },
    live.waitlist > 0 && { text: `${live.waitlist} ${live.waitlist === 1 ? "grupo" : "grupos"} en lista de espera.`, href: "/reservas", tone: "info" as const },
  ].filter(Boolean) as Alert[];

  return (
    <PageContainer width="wide">
      <PageHeader title="Inicio" description={`Hola, ${userName}. Así viene el día.`} />
      {/* Celular: lo urgente primero. */}
      <div className="lg:hidden mb-3"><Alerts alerts={alerts} /></div>
      <div className="grid gap-3 lg:gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3 lg:space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Kpi label="Vendido hoy" value={formatCurrency(today.totals.total)} sub={d === null ? "Sin datos de la semana pasada" : `${d >= 0 ? "+" : ""}${formatPercent(d)} vs. el ${new Intl.DateTimeFormat("es-AR", { weekday: "long" }).format(new Date())} pasado`} tone={d === null ? undefined : d >= 0 ? "up" : "down"} />
            <Kpi label="Pedidos cobrados" value={String(today.totals.orders)} sub={`Ticket promedio ${formatCurrency(today.totals.avgTicket)}`} />
            <Kpi label="Salón ocupado" value={live.tables ? `${Math.round((live.busyTables / live.tables) * 100)} %` : "—"} sub={`${live.busyTables} mesas · ${live.guests} personas`} />
            <Kpi label="Abierto sin cobrar" value={formatCurrency(live.openTotal)} sub={`${live.openOrders} pedidos en curso`} />
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-sm font-semibold text-text-primary">Ventas por hora</h2>
              <Link href="/reportes" className="text-xs font-semibold text-accent hover:underline">Ver reportes</Link>
            </div>
            <GraficoDeBarras data={hours} xKey="hora" series={[{ key: "total", label: "Vendido" }]} height={220} formato={formatCurrencyCompact} aria="Ventas de hoy por hora" />
          </div>
          <div className="grid gap-3 lg:gap-4 sm:grid-cols-2">
            <StatList title="Lo más pedido hoy">
              {today.byProduct.slice(0, 6).map((p) => <StatRow key={p.name} label={p.name} value={formatQty(p.quantity)} sub={formatCurrency(p.total)} />)}
              {today.byProduct.length === 0 && <StatRow label="Todavía no hay ventas" value="—" />}
            </StatList>
            <StatList title="Mozos hoy">
              {today.byWaiter.slice(0, 6).map((w) => <StatRow key={w.name} label={w.name} value={formatCurrency(w.total)} sub={`${w.orders} mesas · propinas ${formatCurrency(w.tips)}`} />)}
              {today.byWaiter.length === 0 && <StatRow label="Todavía no hay ventas" value="—" />}
            </StatList>
          </div>
        </div>
        <div className="space-y-3 lg:space-y-4">
          <div className="hidden lg:block"><Alerts alerts={alerts} /></div>
          <StatList title="Ahora">
            <StatRow label="En cocina" value={String(live.kitchen)} sub={live.late ? `${live.late} demoradas` : "Al día"} color={live.late ? "var(--error)" : undefined} href="/cocina" />
            <StatRow label="Tiempo promedio de cocina" value={today.byStation.length ? `${Math.round(today.byStation.reduce((s, x) => s + x.avgMin * x.tickets, 0) / Math.max(1, today.byStation.reduce((s, x) => s + x.tickets, 0)))} min` : "—"} />
            <StatRow label="Propinas del día" value={formatCurrency(today.totals.tips)} />
            {today.byType.map((t) => <StatRow key={t.type} label={ORDER_TYPE_LABEL[t.type] ?? t.type} value={formatCurrency(t.total)} sub={`${t.orders} pedidos`} />)}
          </StatList>
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">Próximas reservas</p>
              <Link href="/reservas" className="text-xs font-semibold text-accent hover:underline">Todas</Link>
            </div>
            {reservations.length === 0 && <p className="px-4 pb-3 text-sm text-text-secondary">Nada más por hoy.</p>}
            {reservations.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-t border-border px-4 py-2.5">
                <span className="w-12 text-sm font-semibold tabular-nums text-text-primary">{formatTime(r.dateTime)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text-primary truncate">{r.name} · {r.partySize}p{r.table ? ` · Mesa ${r.table}` : ""}</p>
                  {r.notes && <p className="text-xs text-text-muted truncate">{r.notes}</p>}
                </div>
              </div>
            ))}
          </div>
          {lowStock.length > 0 && (
            <StatList title="Insumos bajos">
              {lowStock.map((i) => <StatRow key={i.id} label={i.name} value={`${formatQty(i.stock)} ${i.unit}`} sub={`mínimo ${formatQty(i.minStock)}`} color={i.stock <= 0 ? "var(--error)" : "var(--warning)"} href="/insumos" />)}
            </StatList>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 lg:p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="text-lg lg:text-xl font-bold tabular-nums text-text-primary mt-1 truncate">{value}</p>
      {sub && <p className={cn("text-xs mt-0.5 leading-snug", tone === "up" ? "text-success-strong" : tone === "down" ? "text-error" : "text-text-muted")}>{sub}</p>}
    </div>
  );
}

type Alert = { text: string; href: string; tone: "error" | "warning" | "info" };

function Alerts({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const bar = { error: "var(--error)", warning: "var(--warning)", info: "var(--info)" };
  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">Necesita atención</p>
      {alerts.map((a) => (
        <Link key={a.text} href={a.href} className="flex items-center gap-3 border-t border-border px-4 py-3 hover:bg-surface-secondary">
          <span className="w-1 self-stretch rounded-full shrink-0" style={{ background: bar[a.tone] }} />
          <span className="flex-1 text-sm font-medium text-text-primary">{a.text}</span>
          <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
        </Link>
      ))}
    </div>
  );
}
