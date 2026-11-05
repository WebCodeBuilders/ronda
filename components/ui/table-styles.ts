/**
 * Densidad y estructura ÚNICAS de los listados de escritorio.
 *
 * Hasta septiembre de 2026 cada módulo tenía su propia planilla: Productos con
 * `py-3`, Comprobantes con `py-2`, Pedidos con `py-2.5`, y los encabezados
 * cambiaban de peso y tamaño según quién los hubiera escrito. El owner lo
 * notó al navegar entre Caja, Productos y Comprobantes: las filas eran altas
 * y la pantalla cambiaba de "formato" en cada módulo. Estos son los valores
 * que comparten todas las tablas, declarados una vez.
 *
 * `MobileTable` los usa por dentro. Las tablas que no pueden pasar por
 * `MobileTable` (Productos con variantes desplegables y checkboxes, las
 * planillas con inputs inline) los toman de acá con `cn()`, así compactar
 * las filas se hace en UN archivo.
 *
 * Alturas resultantes: una fila de una línea mide ~34px; una de dos líneas
 * (nombre + SKU) ~50px. Antes: 44px y 60px.
 */
export const tableCls = {
  /** Marco redondeado con borde; contiene la tabla (y el paginador si lo hay). */
  frame: "overflow-hidden rounded-2xl border border-border bg-surface",
  /** Envoltorio con scroll horizontal propio: la página nunca scrollea a lo ancho. */
  scroll: "overflow-x-auto",
  table: "w-full text-sm",
  thead: "bg-surface-secondary",
  /**
   * Encabezado: chico, en mayúsculas. El primero y el último
   * llevan un poco más de aire contra el marco redondeado.
   */
  th: "px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-text-secondary first:pl-4 last:pr-4",
  thRight: "text-right",
  /** Fila: divisor arriba; la cebra la pone globals.css (tbody > tr:nth-child(even)). */
  tr: "border-t border-border transition-colors",
  trClickable: "cursor-pointer hover:bg-surface-secondary/60",
  /** Celda: la altura de la fila sale de acá. `leading-snug` aprieta las de dos líneas. */
  td: "px-3 py-1.5 align-middle text-sm leading-snug text-text-primary first:pl-4 last:pr-4",
  tdRight: "text-right tabular-nums",
  tdMuted: "text-text-secondary",
  /** Segundo renglón dentro de una celda (SKU, email, detalle). */
  sub: "mt-0.5 text-xs leading-tight text-text-muted",
  /** Pie del marco (paginación, "ver más"). */
  footer: "flex items-center justify-between gap-3 border-t border-border px-4 py-2 text-xs text-text-muted",
} as const;
