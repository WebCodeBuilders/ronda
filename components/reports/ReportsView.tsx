"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download } from "lucide-react";
import { Button, Input, tableCls } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatList, StatRow } from "@/components/shared/StatList";
import { GraficoDeBarras, GraficoDeLinea } from "@/components/charts/Chart";
import type { SalesReport } from "@/lib/reports";
import { ORDER_TYPE_LABEL } from "@/lib/orders/labels";
import { formatCurrency, formatCurrencyCompact, formatDate, formatPercent, formatQty, cn } from "@/lib/utils";

function iso(d: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(d);
}

function presets() {
  const today = new Date();
  const d = (n: number) => iso(new Date(today.getTime() - n * 86_400_000));
  return [
    { label: "Hoy", from: d(0), to: d(0) },
    { label: "Ayer", from: d(1), to: d(1) },
    { label: "7 días", from: d(6), to: d(0) },
    { label: "30 días", from: d(29), to: d(0) },
  ];
}

function pct(now: number, before: number) {
  if (!before) return undefined;
  const p = ((now - before) / before) * 100;
  return `${p >= 0 ? "+" : ""}${formatPercent(p)} vs. período anterior`;
}

function csv(rows: (string | number)[][], name: string) {
  const body = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
  const blob = new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
}

export function ReportsView({ report, prev, from, to }: { report: SalesReport; prev: SalesReport["totals"]; from: string | null; to: string | null }) {
  const router = useRouter();
  const [f, setF] = useState(from ?? presets()[2]!.from);
  const [t, setT] = useState(to ?? presets()[2]!.to);
  const go = (a: string, b: string) => router.push(`/reportes?desde=${a}&hasta=${b}`);
  const r = report;
  const hours = r.byHour.filter((h) => h.hour >= 8 || h.total > 0).map((h) => ({ hora: `${h.hour}h`, total: h.total }));

  return (
    <PageContainer width="wide">
      <PageHeader
        title="Reportes"
        action={
          <Button variant="outline" size="sm" icon={<Download className="w-4 h-4" />} onClick={() => csv([["Producto", "Categoría", "Cantidad", "Vendido"], ...r.byProduct.map((p) => [p.name, p.category, p.quantity, p.total])], `ventas-por-producto-${f}-${t}.csv`)}>
            Exportar productos
          </Button>
        }
      />
      <div className="flex flex-wrap items-end gap-2 mb-4">
        {presets().map((p) => (
          <button key={p.label} onClick={() => { setF(p.from); setT(p.to); go(p.from, p.to); }} className={cn("h-10 px-3 rounded-xl border text-sm font-semibold", f === p.from && t === p.to ? "bg-accent-light text-accent border-accent" : "border-border bg-surface text-text-secondary")}>{p.label}</button>
        ))}
        <div className="w-40"><Input type="date" value={f} onChange={(e) => setF(e.target.value)} aria-label="Desde" /></div>
        <div className="w-40"><Input type="date" value={t} onChange={(e) => setT(e.target.value)} aria-label="Hasta" /></div>
        <Button size="sm" onClick={() => go(f, t)}>Ver</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi label="Ventas" value={formatCurrency(r.totals.total)} sub={pct(r.totals.total, prev.total)} up={r.totals.total >= prev.total} />
        <Kpi label="Pedidos" value={String(r.totals.orders)} sub={pct(r.totals.orders, prev.orders)} up={r.totals.orders >= prev.orders} />
        <Kpi label="Ticket promedio" value={formatCurrency(r.totals.avgTicket)} sub={pct(r.totals.avgTicket, prev.avgTicket)} up={r.totals.avgTicket >= prev.avgTicket} />
        <Kpi label="Por comensal" value={formatCurrency(r.totals.perGuest)} sub={`${r.totals.guests} comensales`} />
      </div>

      <div className="grid gap-3 lg:gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3 lg:space-y-4 min-w-0">
          <Card title="Ventas por día">
            <GraficoDeLinea data={r.byDay.map((d) => ({ dia: d.day.slice(8, 10) + "/" + d.day.slice(5, 7), total: d.total }))} xKey="dia" series={[{ key: "total", label: "Ventas" }]} formato={formatCurrencyCompact} aria="Ventas por día" />
          </Card>
          <Card title="Horas pico">
            <GraficoDeBarras data={hours} xKey="hora" series={[{ key: "total", label: "Ventas" }]} formato={formatCurrencyCompact} height={220} aria="Ventas por hora del día" />
          </Card>
          <div className={tableCls.frame}>
            <p className="px-4 pt-3 pb-1 text-sm font-semibold text-text-primary">Productos</p>
            <div className={tableCls.scroll}>
              <table className={tableCls.table}>
                <thead className={tableCls.thead}><tr><th className={tableCls.th}>Producto</th><th className={cn(tableCls.th, tableCls.thRight)}>Cantidad</th><th className={cn(tableCls.th, tableCls.thRight)}>Vendido</th><th className={cn(tableCls.th, tableCls.thRight)}>% ventas</th></tr></thead>
                <tbody>
                  {r.byProduct.slice(0, 25).map((p) => (
                    <tr key={p.name} className={tableCls.tr}>
                      <td className={tableCls.td}>{p.name}<div className={tableCls.sub}>{p.category}</div></td>
                      <td className={cn(tableCls.td, tableCls.tdRight)}>{formatQty(p.quantity)}</td>
                      <td className={cn(tableCls.td, tableCls.tdRight)}>{formatCurrency(p.total)}</td>
                      <td className={cn(tableCls.td, tableCls.tdRight, tableCls.tdMuted)}>{r.totals.total ? formatPercent((p.total / r.totals.total) * 100) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className={tableCls.frame}>
            <p className="px-4 pt-3 pb-1 text-sm font-semibold text-text-primary">Mozos</p>
            <div className={tableCls.scroll}>
              <table className={tableCls.table}>
                <thead className={tableCls.thead}><tr><th className={tableCls.th}>Mozo</th><th className={cn(tableCls.th, tableCls.thRight)}>Pedidos</th><th className={cn(tableCls.th, tableCls.thRight)}>Comensales</th><th className={cn(tableCls.th, tableCls.thRight)}>Ticket prom.</th><th className={cn(tableCls.th, tableCls.thRight)}>Propinas</th><th className={cn(tableCls.th, tableCls.thRight)}>Vendido</th></tr></thead>
                <tbody>
                  {r.byWaiter.map((w) => (
                    <tr key={w.name} className={tableCls.tr}>
                      <td className={tableCls.td}>{w.name}</td>
                      <td className={cn(tableCls.td, tableCls.tdRight)}>{w.orders}</td>
                      <td className={cn(tableCls.td, tableCls.tdRight)}>{w.guests}</td>
                      <td className={cn(tableCls.td, tableCls.tdRight)}>{formatCurrency(w.avg)}</td>
                      <td className={cn(tableCls.td, tableCls.tdRight)}>{formatCurrency(w.tips)}</td>
                      <td className={cn(tableCls.td, tableCls.tdRight, "font-semibold")}>{formatCurrency(w.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="space-y-3 lg:space-y-4">
          <StatList title="Resultado">
            <StatRow label="Ventas" value={formatCurrency(r.totals.total)} />
            <StatRow label="Costo de mercadería" value={formatCurrency(r.totals.cost)} />
            <StatRow label="Margen bruto" value={formatPercent(r.totals.grossMarginPct)} color="var(--success-strong)" />
            <StatRow label="Descuentos otorgados" value={formatCurrency(r.totals.discounts)} />
            <StatRow label="Propinas" value={formatCurrency(r.totals.tips)} />
            <StatRow label="Tiempo promedio en mesa" value={r.totals.avgTableMinutes ? `${r.totals.avgTableMinutes} min` : "—"} />
          </StatList>
          <StatList title="Medios de pago">
            {r.byMethod.map((m) => <StatRow key={m.name} label={`${m.name} (${m.count})`} value={formatCurrency(m.total)} />)}
          </StatList>
          <StatList title="Canal">
            {r.byType.map((t) => <StatRow key={t.type} label={ORDER_TYPE_LABEL[t.type] ?? t.type} value={formatCurrency(t.total)} sub={`${t.orders} pedidos`} />)}
          </StatList>
          <StatList title="Categorías">
            {r.byCategory.map((c) => <StatRow key={c.name} label={c.name} value={formatCurrency(c.total)} sub={`${formatQty(c.quantity)} u.`} />)}
          </StatList>
          <StatList title="Cocina: tiempo hasta listo">
            {r.byStation.map((s) => <StatRow key={s.name} label={s.name} value={`${s.avgMin} min`} sub={`${s.tickets} comandas · ${s.latePct} % pasó 15 min`} color={s.latePct > 25 ? "var(--error)" : undefined} />)}
            {r.byStation.length === 0 && <StatRow label="Sin datos" value="—" />}
          </StatList>
          <StatList title={`Anulaciones (${r.totals.voids})`}>
            {r.voids.slice(0, 8).map((v, i) => (
              <StatRow key={i} label={`${formatQty(v.quantity)}× ${v.name}`} value={formatCurrency(v.total)} sub={`${v.reason ?? "Sin motivo"} · ${formatDate(v.at)}`} href={`/pedidos/${v.orderId}`} />
            ))}
            {r.voids.length === 0 && <StatRow label="Sin anulaciones" value="—" />}
            {r.totals.cancelled > 0 && <StatRow label="Pedidos anulados" value={String(r.totals.cancelled)} href="/pedidos?estado=CANCELLED" />}
          </StatList>
          <Link href="/configuracion/historial" className="block text-sm font-semibold text-accent hover:underline px-1">Ver historial de acciones sensibles</Link>
        </div>
      </div>
    </PageContainer>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-semibold text-text-primary mb-2">{title}</h2>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub, up }: { label: string; value: string; sub?: string; up?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-3 lg:p-4">
      <p className="text-xs font-medium text-text-secondary">{label}</p>
      <p className="text-lg lg:text-xl font-bold tabular-nums text-text-primary mt-1 truncate">{value}</p>
      {sub && <p className={cn("text-xs mt-0.5", up === undefined ? "text-text-muted" : up ? "text-success-strong" : "text-error")}>{sub}</p>}
    </div>
  );
}
