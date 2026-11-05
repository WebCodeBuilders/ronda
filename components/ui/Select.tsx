"use client";

import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputClasses } from "./Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

/** Select nativo con la forma del sistema: en celular abre el selector del teléfono. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, options, placeholder, className, id, ...props },
  ref,
) {
  const selectId = id ?? props.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={selectId} className="block text-sm font-medium mb-1.5 text-text-primary">
          {label}
        </label>
      )}
      <div className="relative">
        <select ref={ref} id={selectId} className={cn(inputClasses, "appearance-none pr-9 min-h-11 lg:min-h-0", className)} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
      </div>
      {hint && <p className="text-xs mt-1 text-text-muted">{hint}</p>}
    </div>
  );
});
