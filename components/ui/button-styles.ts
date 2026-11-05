import { cn } from "@/lib/utils";

/**
 * Las clases del botón del sistema, en un módulo sin "use client": así un
 * `<Link>` (también desde un componente de servidor) se ve EXACTAMENTE como un
 * `Button`, en vez de copiar sus clases a mano y que cada pantalla tenga su
 * propio botón.
 */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "danger-outline";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1 " +
  "disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-white hover:bg-accent-hover shadow-sm",
  secondary: "bg-accent-light text-accent hover:brightness-95",
  outline: "border border-border bg-surface text-text-primary hover:bg-surface-secondary",
  ghost: "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
  danger: "bg-error text-white hover:brightness-90 shadow-sm",
  "danger-outline": "border border-error/40 text-error hover:bg-error-subtle",
};

/**
 * El radio va con el tamaño (decisión del dueño, octubre 2026): el botón normal
 * y el grande llevan 16px (`rounded-2xl`), la firma de la app; el chico baja a
 * 12px (`rounded-xl`), porque 16px en un botón de ~30px ya es una píldora.
 *
 * `min-h-*` solo en móvil (`lg:min-h-0` devuelve el alto exacto de escritorio).
 * `md` llega a 44px, el mínimo táctil cómodo; `sm` se queda en 40px porque vive en
 * barras densas y 44 las rompería. Para íconos sueltos usar la utilidad `.tap-44`.
 */
const sizes: Record<ButtonSize, string> = {
  sm: "rounded-xl text-xs px-3.5 py-1.5 min-h-10 lg:min-h-0",
  md: "rounded-2xl text-sm px-5 py-2.5 min-h-11 lg:min-h-0",
  lg: "rounded-2xl text-base px-7 py-3 min-h-12 lg:min-h-0",
};

export function buttonClasses(
  { variant = "primary", size = "md", fullWidth = false }: { variant?: ButtonVariant; size?: ButtonSize; fullWidth?: boolean } = {},
  className?: string,
): string {
  return cn(base, variants[variant], sizes[size], fullWidth && "w-full", className);
}
