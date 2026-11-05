/**
 * Colores que elige el usuario (de un mozo, una estación, una categoría):
 * salen de esta lista fija de tokens, nunca de un hex suelto.
 */
export const COLOR_OPTIONS = ["accent", "turquesa", "violet", "success", "warning", "error", "info", "neutral"] as const;
export type ColorName = (typeof COLOR_OPTIONS)[number];

export const COLOR_LABEL: Record<ColorName, string> = {
  accent: "Azul",
  turquesa: "Turquesa",
  violet: "Lila",
  success: "Verde",
  warning: "Ámbar",
  error: "Rojo",
  info: "Celeste",
  neutral: "Gris",
};

const SOLID: Record<ColorName, string> = {
  accent: "var(--accent)",
  turquesa: "var(--accent-secondary)",
  violet: "var(--violet)",
  success: "var(--success)",
  warning: "var(--warning)",
  error: "var(--error)",
  info: "var(--info)",
  neutral: "var(--text-muted)",
};

const SOFT: Record<ColorName, string> = {
  accent: "var(--accent-light)",
  turquesa: "color-mix(in srgb, var(--accent-secondary) 16%, white)",
  violet: "var(--violet-light)",
  success: "var(--success-light)",
  warning: "var(--warning-light)",
  error: "var(--error-light)",
  info: "var(--info-light)",
  neutral: "var(--surface-secondary)",
};

function norm(c: string | null | undefined): ColorName {
  return (COLOR_OPTIONS as readonly string[]).includes(c ?? "") ? (c as ColorName) : "accent";
}

export function solidColor(c: string | null | undefined): string {
  return SOLID[norm(c)];
}

export function softColor(c: string | null | undefined): string {
  return SOFT[norm(c)];
}

/** Iniciales solo con letras: "Joaquín (moto)" → "JM", nunca "J(". */
export function initials(name: string): string {
  return name
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/** Orden natural de nombres de mesa: 1, 2, 10 (y no 1, 10, 2). */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, "es", { numeric: true, sensitivity: "base" });
}
