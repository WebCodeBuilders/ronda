/**
 * ─── LA PALETA DE LOS GRÁFICOS ───────────────────────────────────────────────
 *
 * Un solo lugar para los colores de las series. Estaba escrita a mano en
 * `AnalyticsClient` y en `CostBreakdownPanel`, con hexadecimales sueltos y
 * distintos entre sí.
 *
 * ── Por qué hay dos juegos ──
 *
 * En pantalla, los colores salen de los tokens (`var(--accent)`): así siguen la
 * paleta de la app y cambian con ella.
 *
 * En el PDF **no**. `AnalyticsPdfButton` escribe el HTML en una ventana nueva
 * sin la hoja de estilos de la app: ahí `var(--accent)` no resuelve a nada y el
 * gráfico sale sin color. Por eso cada color tiene su valor literal, y los
 * componentes aceptan el juego por prop.
 */

export interface ColorDeSerie {
  /** Para la pantalla: sigue el tema de la app. */
  token: string;
  /** Para el PDF y el canvas: el valor resuelto. */
  literal: string;
}

/**
 * Series categóricas. El orden importa: la primera serie de cualquier gráfico es
 * el acento de la app, que es lo que el ojo busca primero.
 */
export const SERIES: ColorDeSerie[] = [
  { token: "var(--accent)", literal: "#0A3D62" },
  { token: "var(--violet)", literal: "#8A5A85" },
  { token: "var(--success)", literal: "#16A34A" },
  { token: "var(--warning)", literal: "#D97706" },
  { token: "var(--info)", literal: "#0284C7" },
  { token: "var(--error)", literal: "#DC2626" },
  { token: "var(--success-strong)", literal: "#15803D" },
  { token: "var(--violet-strong)", literal: "#6E4569" },
];

/** Semánticos: cuando el color SIGNIFICA algo (ganancia, costo, impuesto). */
export const SEMANTICOS = {
  bueno: { token: "var(--success)", literal: "#16A34A" },
  malo: { token: "var(--error)", literal: "#DC2626" },
  aviso: { token: "var(--warning)", literal: "#D97706" },
  neutro: { token: "var(--text-muted)", literal: "#8A9EB1" },
  acento: { token: "var(--accent)", literal: "#0A3D62" },
} as const;

/** Los colores de la grilla y los ejes. */
export const CHROME = {
  grid: { token: "var(--border)", literal: "#D6DFE8" },
  texto: { token: "var(--text-muted)", literal: "#8A9EB1" },
  superficie: { token: "var(--surface)", literal: "#FFFFFF" },
} as const;

export type ModoColor = "pantalla" | "pdf";

export function color(c: { token: string; literal: string }, modo: ModoColor): string {
  return modo === "pdf" ? c.literal : c.token;
}

/** El color n-ésimo de la paleta, dando la vuelta si se piden más de los que hay. */
export function colorDeSerie(i: number, modo: ModoColor = "pantalla"): string {
  return color(SERIES[i % SERIES.length], modo);
}
