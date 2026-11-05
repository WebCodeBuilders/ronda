import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Fecha y hora en formato argentino: `06/09/2026, 11:33`.
 *
 * `hour12: false` NO es cosmético. Sin eso, el reloj lo elige el ICU de cada
 * lado: Node resuelve `es-AR` a 12 horas y escribe `11:33 a. m.` (con espacio
 * duro incluido), mientras que Chrome usa 24 y escribe `11:33`. Como esta
 * función también corre en componentes de cliente que se renderizan en el
 * servidor, esa diferencia llegaba al navegador como un error de hidratación
 * ("some attributes of the server rendered HTML didn't match"). Fijar el reloj
 * hace que los dos lados escriban lo mismo — y de paso, 24 horas es como se lee
 * la hora acá.
 */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).format(new Date(date));
}

/**
 * La hora de la app es la de Buenos Aires, la corra quien la corra. Sin esto
 * el servidor escribe la hora de SU zona (UTC en el hosting) y el navegador la
 * del usuario: tres horas de diferencia en la misma pantalla.
 */
export const APP_TIME_ZONE = "America/Argentina/Buenos_Aires";

/** Solo la hora, 24 h: `14:51`. Nunca `02:51 p. m.` (mismo motivo que `formatDate`). */
export function formatTime(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: APP_TIME_ZONE,
  }).format(new Date(date));
}

/**
 * Plata abreviada para rótulos chicos (barras de un gráfico): `$ 120 mil`,
 * `$ 1,5 M`. A mano y no con `notation: "compact"` porque el ICU de Node y el
 * de Chrome no abrevian igual ("120 k" / "120 mil").
 */
export function formatCurrencyCompact(amount: number): string {
  const n = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const fmt = (x: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(x);
  if (n >= 1_000_000) return `${sign}$ ${fmt(n / 1_000_000)} M`;
  if (n >= 1_000) return `${sign}$ ${fmt(n / 1_000)} mil`;
  return `${sign}$ ${fmt(n)}`;
}

/**
 * Porcentaje para mostrar: coma decimal y el signo pegado como se lee acá,
 * `79,7 %`. `pct` viene en puntos (79.7), no en fracción.
 */
export function formatPercent(pct: number, decimals = 1): string {
  return `${new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: decimals }).format(pct)} %`;
}

/**
 * Cuánto duró algo, en horas y minutos ("3h 20m").
 *
 * Vive acá y no al lado de la caja porque la usan el turno abierto, la tabla
 * del historial y el comprobante de cierre — tres archivos, y dos de ellos a
 * cada lado de la frontera cliente/servidor. Sin `hasta` cuenta hasta ahora.
 */
export function formatDuration(fromIso: string, toIso: string | null): string {
  const from = new Date(fromIso).getTime();
  const to = toIso ? new Date(toIso).getTime() : Date.now();
  const mins = Math.max(0, Math.round((to - from) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/** Minutos transcurridos desde una fecha (para semáforos de cocina y mesas). */
export function minutesSince(date: Date | string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(date).getTime()) / 60000));
}

/** Redondeo a centavos: toda la plata pasa por acá antes de guardarse. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Cantidad sin decimales de más: 2 → "2", 1.5 → "1,5". */
export function formatQty(n: number): string {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 }).format(n);
}

/** Fecha corta sin hora: `05/11/2026`. */
export function formatDay(date: Date | string): string {
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: APP_TIME_ZONE }).format(new Date(date));
}
