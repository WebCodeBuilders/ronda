"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { inputClasses } from "./Input";

interface Props {
  /** Valor numérico actual (o null/"" si vacío). */
  value: number | null | undefined;
  /** Devuelve el número ingresado (o null si el campo queda vacío). */
  onChange: (value: number | null) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
  id?: string;
  name?: string;
  autoFocus?: boolean;
  /** Símbolo a anteponer (default "$"). */
  symbol?: string;
}

// Deja solo dígitos y una única coma decimal.
function sanitize(input: string): string {
  let s = input.replace(/[^\d,]/g, "");
  const first = s.indexOf(",");
  if (first !== -1) {
    s = s.slice(0, first + 1) + s.slice(first + 1).replace(/,/g, "");
  }
  return s;
}

// Texto crudo (digitos + coma) → string a mostrar con $ y separador de miles.
function toDisplay(raw: string, symbol: string): string {
  if (raw === "") return "";
  const [int, dec] = raw.split(",");
  const grouped = (int || "0").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${symbol} ${grouped}${dec !== undefined ? "," + dec : ""}`;
}

function toNumber(raw: string): number | null {
  if (raw === "") return null;
  const n = parseFloat(raw.replace(",", "."));
  return isNaN(n) ? null : n;
}

// Número → texto crudo (con coma decimal) para inicializar/sincronizar.
function numToRaw(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return "";
  return String(n).replace(".", ",");
}

/**
 * Input de moneda: muestra el valor con símbolo y separador de miles
 * (ej. "$ 59.650") mientras el usuario tipea, pero entrega un número limpio.
 */
export function CurrencyInput({
  value, onChange, placeholder, className, style, disabled, id, name, autoFocus, symbol = "$",
}: Props) {
  const [raw, setRaw] = useState<string>(numToRaw(value));

  // Sincroniza si el valor cambia desde afuera (reset de formularios, etc.).
  useEffect(() => {
    if (value !== toNumber(raw)) setRaw(numToRaw(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      id={id}
      name={name}
      disabled={disabled}
      autoFocus={autoFocus}
      placeholder={placeholder ?? `${symbol} 0`}
      value={toDisplay(raw, symbol)}
      onChange={(e) => {
        const s = sanitize(e.target.value);
        setRaw(s);
        onChange(toNumber(s));
      }}
      // Mismo aspecto que cualquier campo del sistema; lo que venga en className lo ajusta.
      className={cn(inputClasses, "min-h-11 lg:min-h-0 tabular-nums", className)}
      style={style}
    />
  );
}
