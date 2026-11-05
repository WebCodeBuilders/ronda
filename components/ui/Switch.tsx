"use client";

import { cn } from "@/lib/utils";

export interface SwitchProps {
  checked: boolean;
  /** Sin esto, el interruptor es DECORATIVO: lo maneja quien lo envuelve. */
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Obligatorio en el modo interactivo: es lo único que anuncia un lector de pantalla. */
  label?: string;
  className?: string;
}

/**
 * El interruptor de la casa.
 *
 * Existía cuatro veces, escrito a mano, con tres apagados distintos
 * (`--border-strong`, `--border`, `--surface-secondary`), dos tamaños (20px y
 * 24px de alto) y una sola de las cuatro con `role="switch"` — las otras eran
 * un `<span>` que un lector de pantalla no anuncia como control.
 *
 * Acá va uno solo: 24×44px (área tocable cómoda), apagado en `--border-strong`
 * —que es el único de los tres que se lee como "apagado" y no como "vacío"— y
 * `role="switch"` de verdad.
 *
 * **Modo decorativo**: sin `onChange` se dibuja como un `<span aria-hidden>`. Es
 * para las filas donde el control es la fila entera (un `<button>` que envuelve
 * texto + interruptor): un `<button>` dentro de otro `<button>` es HTML inválido
 * y el navegador lo desarma.
 */
export function Switch({ checked, onChange, disabled, label, className }: SwitchProps) {
  const track = cn(
    "relative inline-block h-6 w-11 shrink-0 rounded-2xl transition-colors duration-150",
    disabled && "opacity-50",
    className,
  );
  const trackStyle = {
    backgroundColor: checked ? "var(--accent)" : "var(--border-strong)",
  };
  const knob = (
    <span
      className={cn(
        "absolute top-1 left-1 block h-4 w-4 rounded-2xl bg-white shadow-sm transition-transform duration-150",
        checked && "translate-x-5",
      )}
    />
  );

  if (!onChange) {
    return (
      <span aria-hidden className={track} style={trackStyle}>
        {knob}
      </span>
    );
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(track, "fs-press cursor-pointer disabled:cursor-not-allowed")}
      style={trackStyle}
    >
      {knob}
    </button>
  );
}
