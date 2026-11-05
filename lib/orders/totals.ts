import { round2 } from "@/lib/utils";

/**
 * La cuenta de un pedido, en UN solo lugar. La usan el servidor al guardar,
 * la pantalla del pedido, la precuenta impresa y los reportes: si cada uno
 * sumara a su manera, la mesa diría un total y el ticket otro.
 */

export type TotalsItem = { unitPrice: number; quantity: number; status: string };

export type TotalsInput = {
  items: TotalsItem[];
  discountPct?: number;
  discountAmount?: number;
  serviceCharge?: number;
  deliveryFee?: number;
};

export type Totals = {
  subtotal: number;
  discount: number;
  serviceCharge: number;
  deliveryFee: number;
  total: number;
};

export function lineTotal(unitPrice: number, quantity: number): number {
  return round2(unitPrice * quantity);
}

export function computeTotals(input: TotalsInput): Totals {
  const subtotal = round2(
    input.items.filter((i) => i.status !== "VOID").reduce((s, i) => s + lineTotal(i.unitPrice, i.quantity), 0),
  );
  const pct = Math.min(100, Math.max(0, input.discountPct ?? 0));
  // El descuento porcentual va primero; el monto fijo se suma, y nunca deja la cuenta en negativo.
  const discount = round2(Math.min(subtotal, subtotal * (pct / 100) + Math.max(0, input.discountAmount ?? 0)));
  const serviceCharge = round2(Math.max(0, input.serviceCharge ?? 0));
  const deliveryFee = round2(Math.max(0, input.deliveryFee ?? 0));
  const total = round2(subtotal - discount + serviceCharge + deliveryFee);
  return { subtotal, discount, serviceCharge, deliveryFee, total };
}

/** Cubierto: por comensal, solo en mesa. */
export function serviceChargeFor(type: string, guests: number, perGuest: number): number {
  return type === "DINE_IN" || type === "QR" ? round2(Math.max(0, guests) * Math.max(0, perGuest)) : 0;
}

/** Partes iguales que suman EXACTO el total: los centavos que sobran van a la primera. */
export function splitEvenly(total: number, parts: number): number[] {
  const n = Math.max(1, Math.floor(parts));
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / n);
  const rest = cents - base * n;
  return Array.from({ length: n }, (_, i) => (base + (i < rest ? 1 : 0)) / 100);
}

/** Recargo o descuento del medio de pago sobre lo que se cobra. */
export function methodAdjustment(amount: number, adjustPct: number): number {
  return round2(amount * (adjustPct / 100));
}

/** Cuánto falta cobrar. */
export function remaining(total: number, paid: number): number {
  return round2(Math.max(0, total - paid));
}
