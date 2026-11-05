import { formatCurrency, formatTime, formatDate, formatQty } from "@/lib/utils";
import { courseLabel } from "@/lib/orders/labels";

/**
 * Arma el texto de cada impreso al ancho de la impresora. Puro: se prueba sin
 * impresora y la misma salida se ve en la vista previa del navegador.
 */

type Mod = { groupName?: string; name: string; priceDelta?: number };

export type ComandaItem = { quantity: number; name: string; modifiers: Mod[]; notes?: string | null; course: number; seat?: number | null };

function line(w: number, ch = "-") {
  return ch.repeat(w);
}

function wrap(text: string, w: number, indent = ""): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const word of words) {
    if ((cur + " " + word).trim().length > w - indent.length) {
      if (cur) out.push(indent + cur);
      cur = word;
    } else cur = (cur + " " + word).trim();
  }
  if (cur) out.push(indent + cur);
  return out.length ? out : [indent];
}

function cols(left: string, right: string, w: number): string {
  const space = Math.max(1, w - left.length - right.length);
  if (left.length + right.length + 1 > w) return `${left.slice(0, w - right.length - 2)}… ${right}`;
  return left + " ".repeat(space) + right;
}

/** La comanda de cocina/barra. Grande lo que importa: mesa, cantidad, plato. */
export function formatComanda(p: {
  width: number;
  stationName: string;
  label: string;
  ticketNumber: number;
  waiterName?: string | null;
  guests?: number;
  items: ComandaItem[];
  createdAt: Date;
  heading?: string; // "MARCHAR", "ANULACIÓN", "REIMPRESIÓN"
  followUp?: string[]; // lo que viene en pasos siguientes
  notes?: string | null;
}): string {
  const w = p.width;
  const out: string[] = ["@@BEEP"];
  if (p.heading) out.push(`@@LC ${p.heading}`);
  out.push(`@@C ${p.stationName.toUpperCase()} · Comanda ${p.ticketNumber}`);
  out.push(`@@LC ${p.label}`);
  const meta = [formatTime(p.createdAt), p.waiterName ? `Mozo: ${p.waiterName}` : null, p.guests ? `${p.guests} pax` : null].filter(Boolean).join(" · ");
  out.push(`@@C ${meta}`);
  out.push(line(w, "="));
  // Agrupado por paso: la cocina ve el orden de salida.
  const courses = [...new Set(p.items.map((i) => i.course))].sort((a, b) => a - b);
  for (const c of courses) {
    if (courses.length > 1) out.push(`@@B -- ${courseLabel(c).toUpperCase()} --`);
    for (const it of p.items.filter((i) => i.course === c)) {
      const seat = it.seat ? ` (P${it.seat})` : "";
      for (const [idx, l] of wrap(`${formatQty(it.quantity)} x ${it.name}${seat}`, Math.floor(w / 2)).entries()) {
        out.push(idx === 0 ? `@@L ${l}` : `@@L   ${l.trim()}`);
      }
      for (const m of it.modifiers) out.push(...wrap(`> ${m.name}`, w, "   ").map((l) => `@@B ${l}`));
      if (it.notes) out.push(...wrap(`** ${it.notes} **`, w, "   ").map((l) => `@@B ${l}`));
    }
  }
  if (p.notes) {
    out.push(line(w));
    out.push(...wrap(`Nota: ${p.notes}`, w).map((l) => `@@B ${l}`));
  }
  if (p.followUp && p.followUp.length) {
    out.push(line(w));
    out.push("Despues siguen (esperar aviso):");
    out.push(...p.followUp.map((f) => `  ${f}`));
  }
  out.push(line(w, "="));
  out.push("@@CUT");
  return out.join("\n");
}

export type BillLine = { quantity: number; name: string; total: number; modifiers?: Mod[] };

/** Precuenta o recibo de la caja. */
export function formatBill(p: {
  width: number;
  businessName: string;
  address?: string | null;
  taxId?: string | null;
  title: string; // "PRECUENTA" | "RECIBO"
  label: string;
  orderNumber: number;
  waiterName?: string | null;
  guests?: number;
  lines: BillLine[];
  subtotal: number;
  discount: number;
  serviceCharge: number;
  deliveryFee: number;
  total: number;
  payments?: { name: string; amount: number }[];
  tip?: number;
  change?: number;
  suggestedTipPct?: number;
  footer?: string | null;
  date: Date;
}): string {
  const w = p.width;
  const out: string[] = [];
  out.push(`@@LC ${p.businessName}`);
  if (p.address) out.push(`@@C ${p.address}`);
  if (p.taxId) out.push(`@@C CUIT ${p.taxId}`);
  out.push(line(w));
  out.push(`@@BC ${p.title}`);
  out.push(cols(p.label, `N° ${p.orderNumber}`, w));
  out.push(cols(formatDate(p.date), p.guests ? `${p.guests} pax` : "", w));
  if (p.waiterName) out.push(`Atendido por: ${p.waiterName}`);
  out.push(line(w));
  for (const l of p.lines) {
    const left = `${formatQty(l.quantity)} ${l.name}`;
    out.push(cols(left.length > w - 14 ? left.slice(0, w - 15) + "…" : left, formatCurrency(l.total), w));
    for (const m of l.modifiers ?? []) out.push(`   ${m.name}`);
  }
  out.push(line(w));
  out.push(cols("Subtotal", formatCurrency(p.subtotal), w));
  if (p.discount > 0) out.push(cols("Descuento", `-${formatCurrency(p.discount)}`, w));
  if (p.serviceCharge > 0) out.push(cols("Cubiertos", formatCurrency(p.serviceCharge), w));
  if (p.deliveryFee > 0) out.push(cols("Envío", formatCurrency(p.deliveryFee), w));
  out.push(`@@B ${cols("TOTAL", formatCurrency(p.total), w)}`);
  if (p.payments && p.payments.length) {
    out.push(line(w));
    for (const pay of p.payments) out.push(cols(pay.name, formatCurrency(pay.amount), w));
    if (p.tip && p.tip > 0) out.push(cols("Propina", formatCurrency(p.tip), w));
    if (p.change && p.change > 0) out.push(cols("Vuelto", formatCurrency(p.change), w));
  }
  if (p.suggestedTipPct && p.suggestedTipPct > 0 && p.title === "PRECUENTA") {
    out.push(line(w));
    out.push(cols(`Propina sugerida ${p.suggestedTipPct}%`, formatCurrency(Math.round(p.total * p.suggestedTipPct) / 100), w));
  }
  out.push(line(w));
  if (p.title === "PRECUENTA") out.push(...wrap("Documento no válido como factura", w).map((l) => `@@C ${l}`));
  if (p.footer) out.push(...wrap(p.footer, w).map((l) => `@@C ${l}`));
  out.push("@@CUT");
  return out.join("\n");
}
