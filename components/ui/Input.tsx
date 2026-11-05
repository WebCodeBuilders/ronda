"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

/**
 * El radio es `rounded-2xl`, el mismo del `Select`, del `Button` y del buscador
 * de `FilterBar`. Era `rounded-xl` y se notaba: un campo de fecha al lado de un
 * select mostraba dos esquinas distintas en la misma fila.
 *
 * `text-base lg:text-sm` — los 16px en móvil NO son estéticos: iOS Safari hace zoom
 * automático al enfocar cualquier campo de menos de 16px, y ese zoom descoloca el layout
 * y deja scroll horizontal fantasma. En `lg:` vuelve a 14px → el desktop no cambia.
 */
export const inputClasses =
  "w-full px-3.5 py-2.5 rounded-2xl border border-border bg-surface text-base lg:text-sm text-text-primary " +
  "placeholder:text-text-muted outline-none transition-all duration-150 " +
  "focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-60 disabled:bg-surface-secondary";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, icon, className, id, ...props },
  ref,
) {
  const inputId = id ?? props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium mb-1.5 text-text-primary">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none [&>svg]:w-4 [&>svg]:h-4">
            {icon}
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          // `min-h-11` (44px) solo en móvil: área tocable mínima cómoda. `lg:min-h-0` deja
          // el alto de escritorio exactamente como estaba.
          className={cn(
            inputClasses,
            "min-h-11 lg:min-h-0",
            icon && "pl-9",
            error && "border-error focus:border-error focus:ring-error/20",
            className,
          )}
          {...props}
        />
      </div>
      {error && <p className="text-xs mt-1 text-error">{error}</p>}
      {hint && !error && <p className="text-xs mt-1 text-text-muted">{hint}</p>}
    </div>
  );
});
