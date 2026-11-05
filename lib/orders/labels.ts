/**
 * Textos para la gente. Ningún valor interno (OPEN, DINE_IN) llega a una
 * pantalla: todo pasa por acá.
 */

export const ORDER_TYPES = ["DINE_IN", "COUNTER", "TAKEAWAY", "DELIVERY", "QR"] as const;
export type OrderType = (typeof ORDER_TYPES)[number];

export const ORDER_TYPE_LABEL: Record<string, string> = {
  DINE_IN: "Mesa",
  COUNTER: "Mostrador",
  TAKEAWAY: "Para llevar",
  DELIVERY: "Delivery",
  QR: "Mesa (QR)",
};

export const ORDER_STATUS_LABEL: Record<string, string> = {
  OPEN: "Abierto",
  BILLING: "Pidió la cuenta",
  PAID: "Cobrado",
  CANCELLED: "Anulado",
};

export const ORDER_STATUS_TONE: Record<string, "accent" | "neutral" | "success" | "warning" | "error" | "info"> = {
  OPEN: "accent",
  BILLING: "warning",
  PAID: "success",
  CANCELLED: "neutral",
};

export const FULFILLMENT_STEPS = ["PENDING", "PREPARING", "READY", "ON_THE_WAY", "DELIVERED"] as const;

export const FULFILLMENT_LABEL: Record<string, string> = {
  PENDING: "Recibido",
  PREPARING: "En preparación",
  READY: "Listo",
  ON_THE_WAY: "En camino",
  DELIVERED: "Entregado",
};

export const ITEM_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Sin marchar",
  HOLD: "En espera",
  SENT: "En cocina",
  PREPARING: "Preparando",
  READY: "Listo",
  SERVED: "Entregado",
  VOID: "Anulado",
};

export const ITEM_STATUS_TONE: Record<string, "accent" | "neutral" | "success" | "warning" | "error" | "info"> = {
  DRAFT: "neutral",
  HOLD: "warning",
  SENT: "info",
  PREPARING: "accent",
  READY: "success",
  SERVED: "neutral",
  VOID: "error",
};

export const COURSE_LABEL: Record<number, string> = {
  0: "Bebidas",
  1: "Entradas",
  2: "Principales",
  3: "Postres",
  4: "Cafetería",
};

export function courseLabel(c: number): string {
  return COURSE_LABEL[c] ?? `Paso ${c}`;
}

export const TICKET_STATUS_LABEL: Record<string, string> = {
  NEW: "Nueva",
  PREPARING: "Preparando",
  READY: "Lista",
  DONE: "Entregada",
  VOID: "Anulada",
};

export const PAYMENT_KIND_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  QR: "QR / Billetera",
  ACCOUNT: "Cuenta corriente",
  OTHER: "Otro",
};

export const TABLE_SHAPE_LABEL: Record<string, string> = {
  SQUARE: "Cuadrada",
  ROUND: "Redonda",
  RECT: "Rectangular",
  BAR: "Banqueta de barra",
  BOOTH: "Box",
  UMBRELLA: "Sombrilla",
  LOUNGER: "Reposera",
};

export const RESERVATION_STATUS_LABEL: Record<string, string> = {
  PENDING: "A confirmar",
  CONFIRMED: "Confirmada",
  SEATED: "Sentados",
  NO_SHOW: "No vino",
  CANCELLED: "Cancelada",
  DONE: "Terminada",
};

export const REQUEST_KIND_LABEL: Record<string, string> = {
  CALL_WAITER: "Llama al mozo",
  BILL: "Pide la cuenta",
  ORDER: "Pedido desde el QR",
};

/** Cómo se nombra un pedido en una comanda, un aviso o una lista. */
export function orderLabel(o: { type: string; number: number; table?: { name: string } | null; customerName?: string | null }): string {
  if ((o.type === "DINE_IN" || o.type === "QR") && o.table) return `Mesa ${o.table.name}`;
  const who = o.customerName ? ` · ${o.customerName}` : "";
  return `${ORDER_TYPE_LABEL[o.type] ?? o.type} #${o.number}${who}`;
}
