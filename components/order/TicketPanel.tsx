"use client";

import { Minus, Plus } from "lucide-react";
import { Badge } from "@/components/ui";
import type { OrderDetail } from "@/lib/orders/queries";
import { ITEM_STATUS_LABEL, ITEM_STATUS_TONE, courseLabel } from "@/lib/orders/labels";
import { formatCurrency, formatQty, formatTime, cn, round2 } from "@/lib/utils";

type Item = OrderDetail["items"][number];

export function TicketPanel({
  order, onItem, onQty, busyItem, onFireCourse, onServeReady, canEdit, canSend,
}: {
  order: OrderDetail;
  onItem: (i: Item) => void;
  onQty: (i: Item, delta: number) => void;
  busyItem: string | null;
  onFireCourse: (course: number) => void;
  onServeReady: () => void;
  canEdit: boolean;
  canSend: boolean;
}) {
  const active = order.status === "OPEN" || order.status === "BILLING";
  const drafts = order.items.filter((i) => i.status === "DRAFT");
  const held = order.items.filter((i) => i.status === "HOLD");
  const ready = order.items.filter((i) => i.status === "READY");
  const sent = order.items.filter((i) => !["DRAFT", "HOLD"].includes(i.status));
  const heldCourses = [...new Set(held.map((h) => h.course))].sort((a, b) => a - b);
  const discount = round2(order.subtotal * (order.discountPct / 100) + order.discountAmount);

  return (
    <div className="divide-y divide-border">
      {order.customer?.notes && (
        <div className="px-4 py-2.5 bg-warning-subtle text-sm text-warning-strong border-l-4 border-warning">
          <span><b>{order.customer.name}:</b> {order.customer.notes}</span>
        </div>
      )}
      {order.notes && (
        <div className="px-4 py-2.5 bg-info-subtle text-sm text-info-strong border-l-4 border-info">
          <span>{order.notes}</span>
        </div>
      )}

      {ready.length > 0 && active && (
        <div className="px-4 py-3 bg-success-subtle flex items-center gap-3">
          <p className="flex-1 text-sm font-semibold text-success-strong">{ready.length === 1 ? "1 plato listo" : `${ready.length} platos listos`} para llevar</p>
          <button onClick={onServeReady} className="h-9 px-3 rounded-xl bg-success text-white text-xs font-semibold flex items-center gap-1.5 hover:brightness-95">
            Ya los llevé
          </button>
        </div>
      )}

      {drafts.length > 0 && (
        <Section title="Sin marchar" hint="Todavía no llegó a la cocina">
          {drafts.map((i) => (
            <Row key={i.id} item={i} onClick={() => onItem(i)} busy={busyItem === i.id}>
              {canEdit && active && (
                <div className="flex items-center gap-0.5 rounded-xl border border-border bg-surface" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => onQty(i, -1)} className="w-8 h-8 flex items-center justify-center rounded-l-xl hover:bg-surface-secondary" aria-label="Uno menos"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums">{formatQty(i.quantity)}</span>
                  <button onClick={() => onQty(i, 1)} className="w-8 h-8 flex items-center justify-center rounded-r-xl hover:bg-surface-secondary" aria-label="Uno más"><Plus className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </Row>
          ))}
        </Section>
      )}

      {heldCourses.map((c) => (
        <Section
          key={c}
          title={`En espera · ${courseLabel(c)}`}
          hint="La cocina sabe que vienen; salen cuando avises"
          action={
            canSend && active ? (
              <button onClick={() => onFireCourse(c)} className="h-8 px-3 rounded-xl bg-warning text-white text-xs font-semibold flex items-center gap-1.5 hover:brightness-95">
                Marchar
              </button>
            ) : null
          }
        >
          {held.filter((h) => h.course === c).map((i) => (
            <Row key={i.id} item={i} onClick={() => onItem(i)} />
          ))}
        </Section>
      ))}

      {sent.length > 0 && (
        <Section title="Marchado">
          {sent.map((i) => (
            <Row key={i.id} item={i} onClick={() => onItem(i)}>
              <Badge tone={ITEM_STATUS_TONE[i.status]} dot>{ITEM_STATUS_LABEL[i.status]}</Badge>
            </Row>
          ))}
        </Section>
      )}

      {order.items.length === 0 && (
        <div className="px-4 py-12 text-center">
          <p className="text-sm font-semibold text-text-primary">Todavía no hay nada cargado</p>
          <p className="text-sm text-text-secondary mt-1">Tocá los productos de la carta para agregarlos.</p>
        </div>
      )}

      <div className="px-4 py-3 space-y-1 text-sm">
        <Line label="Subtotal" value={formatCurrency(order.subtotal)} />
        {discount > 0 && <Line label={`Descuento${order.discountPct ? ` ${order.discountPct} %` : ""}${order.discountReason ? ` · ${order.discountReason}` : ""}`} value={`−${formatCurrency(discount)}`} tone="text-success-strong" />}
        {order.serviceCharge > 0 && <Line label={`Cubiertos (${order.guests})`} value={formatCurrency(order.serviceCharge)} />}
        {order.type === "DELIVERY" && order.deliveryFee > 0 && <Line label="Envío" value={formatCurrency(order.deliveryFee)} />}
        <div className="flex items-baseline justify-between pt-1.5">
          <span className="text-base font-semibold text-text-primary">Total</span>
          <span className="text-xl font-bold tabular-nums text-text-primary">{formatCurrency(order.total)}</span>
        </div>
        {order.paidAmount > 0 && (
          <>
            <Line label="Cobrado" value={formatCurrency(order.paidAmount)} tone="text-success-strong" />
            {order.total - order.paidAmount > 0.009 && <Line label="Falta cobrar" value={formatCurrency(order.total - order.paidAmount)} tone="text-error font-semibold" />}
          </>
        )}
        {order.tip > 0 && <Line label="Propina" value={formatCurrency(order.tip)} />}
      </div>

      {order.payments.length > 0 && (
        <Section title="Cobros">
          {order.payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-2 text-sm">
              <span className="text-text-secondary">
                {p.method} · {formatTime(p.createdAt)}
                {p.by ? ` · ${p.by}` : ""}
                {p.reference ? <span className="block text-xs text-text-muted">{p.reference}</span> : null}
              </span>
              <span className={cn("font-semibold tabular-nums", p.amount < 0 ? "text-error" : "text-text-primary")}>{formatCurrency(p.amount + p.surcharge)}</span>
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, hint, action, children }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="py-2">
      <div className="flex items-center justify-between gap-2 px-4 pt-1 pb-1.5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">{title}</p>
          {hint && <p className="text-[11px] text-text-muted">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ item, onClick, busy, children }: { item: Item; onClick: () => void; busy?: boolean; children?: React.ReactNode }) {
  const voided = item.status === "VOID";
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      className={cn("flex items-start gap-3 px-4 py-2 cursor-pointer hover:bg-surface-secondary/70 transition-colors", busy && "opacity-60", voided && "opacity-60")}
    >
      <span className={cn("w-7 shrink-0 text-sm font-semibold tabular-nums text-text-primary pt-0.5", voided && "line-through")}>{formatQty(item.quantity)}×</span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-medium text-text-primary leading-snug", voided && "line-through")}>
          {item.name}
          {item.seat ? <span className="ml-1.5 text-xs font-semibold text-violet-strong">P{item.seat}</span> : null}
        </p>
        {item.modifiers.length > 0 && <p className="text-xs text-text-secondary leading-snug">{item.modifiers.map((m) => m.name).join(" · ")}</p>}
        {item.notes && <p className="text-xs font-medium text-warning-strong leading-snug">{item.notes}</p>}
        {voided && item.voidReason && <p className="text-xs text-error">Anulado: {item.voidReason}</p>}
        {item.sentAt && !voided && item.status !== "SERVED" && (
          <p className="text-[11px] text-text-muted mt-0.5">{item.station ?? "Cocina"} · {formatTime(item.sentAt)}</p>
        )}
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <span className={cn("text-sm font-semibold tabular-nums text-text-primary", voided && "line-through text-text-muted")}>{formatCurrency(item.total)}</span>
        {children}
      </div>
    </div>
  );
}

function Line({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-text-secondary truncate">{label}</span>
      <span className={cn("tabular-nums text-text-primary", tone)}>{value}</span>
    </div>
  );
}
