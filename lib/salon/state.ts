/**
 * El estado de una mesa, en una palabra, calculado en UN lugar. Lo usan el
 * plano, la lista del mozo y el tablero de inicio.
 *
 * Prioridad (lo más urgente gana): llamando > platos listos para llevar >
 * comanda demorada > pidió la cuenta > ocupada > reservada > libre.
 */

export type TableState = "FREE" | "RESERVED" | "OCCUPIED" | "BILLING" | "LATE" | "READY" | "CALLING";

export type TableFacts = {
  hasOrder: boolean;
  orderStatus?: string | null;
  readyItems: number;
  draftItems: number;
  oldestPendingSentAt?: Date | string | null; // comanda más vieja sin terminar
  openRequests: number;
  reservationSoon: boolean;
};

export function tableState(f: TableFacts, lateMinutes: number, now = Date.now()): TableState {
  if (f.openRequests > 0) return "CALLING";
  if (!f.hasOrder) return f.reservationSoon ? "RESERVED" : "FREE";
  if (f.readyItems > 0) return "READY";
  if (f.oldestPendingSentAt && now - new Date(f.oldestPendingSentAt).getTime() > lateMinutes * 60_000) return "LATE";
  if (f.orderStatus === "BILLING") return "BILLING";
  return "OCCUPIED";
}

export const TABLE_STATE_LABEL: Record<TableState, string> = {
  FREE: "Libre",
  RESERVED: "Reservada",
  OCCUPIED: "Ocupada",
  BILLING: "Pidió la cuenta",
  LATE: "Demorada",
  READY: "Platos listos",
  CALLING: "Llama al mozo",
};

/** Colores por estado: fondo, borde y texto, siempre de tokens. */
export const TABLE_STATE_STYLE: Record<TableState, { bg: string; border: string; text: string; dot: string }> = {
  FREE: { bg: "var(--surface)", border: "var(--border-strong)", text: "var(--text-secondary)", dot: "var(--text-muted)" },
  RESERVED: { bg: "var(--info-subtle)", border: "var(--info)", text: "var(--info-strong)", dot: "var(--info)" },
  OCCUPIED: { bg: "var(--accent-light)", border: "var(--accent)", text: "var(--accent)", dot: "var(--accent)" },
  BILLING: { bg: "var(--warning-light)", border: "var(--warning)", text: "var(--warning-strong)", dot: "var(--warning)" },
  LATE: { bg: "var(--error-light)", border: "var(--error)", text: "var(--error-strong)", dot: "var(--error)" },
  READY: { bg: "var(--success-light)", border: "var(--success)", text: "var(--success-strong)", dot: "var(--success)" },
  // Un cliente que llama no es una demora: otro color, para que el mozo distinga de lejos.
  CALLING: { bg: "var(--violet-light)", border: "var(--violet)", text: "var(--violet-strong)", dot: "var(--violet)" },
};
