"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { ModalShell } from "@/components/shared/ModalShell";
import { Input } from "@/components/ui";

interface TextPromptModalProps {
  title: string;
  /** Etiqueta del campo. Es la pregunta concreta. */
  label: string;
  /** Contexto opcional: por qué se pide el dato y qué pasa después. */
  description?: string;
  placeholder?: string;
  confirmLabel?: string;
  /** Mensaje cuando se confirma vacío. Vacío nunca se acepta. */
  emptyMessage?: string;
  busy?: boolean;
  onConfirm: (value: string) => void;
  onClose: () => void;
}

/**
 * Reemplazo de `window.prompt` para pedir UN dato de texto.
 *
 * El prompt del navegador venía de arriba sin estilo ni marca, no se podía
 * explicar (una sola línea, sin lugar para decir qué se está pidiendo), en
 * celular tapa la pantalla entera y hay navegadores que directamente lo
 * bloquean si la pestaña no está enfocada — con lo cual la acción quedaba
 * trabada sin ningún aviso. Esto usa el mismo `ModalShell` que el resto: sheet
 * desde abajo en celular, modal centrado en escritorio, Escape para cerrar.
 */
export function TextPromptModal({
  title,
  label,
  description,
  placeholder,
  confirmLabel = "Confirmar",
  emptyMessage = "Completá este dato para continuar.",
  busy = false,
  onConfirm,
  onClose,
}: TextPromptModalProps) {
  const [value, setValue] = useState("");
  const [touchedEmpty, setTouchedEmpty] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const clean = value.trim();
    // El aviso va PEGADO al campo, no en el cartel de error de la página: el
    // error de un formulario se lee donde está el formulario.
    if (!clean) { setTouchedEmpty(true); return; }
    onConfirm(clean);
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-sm">
      <form onSubmit={submit}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-sm text-text-primary">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-1.5 rounded-lg hover:bg-surface-secondary"
          >
            <X className="w-4 h-4 text-text-muted" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {description && <p className="text-sm text-text-secondary">{description}</p>}
          <div className="space-y-1.5">
            <label htmlFor="text-prompt-value" className="block text-xs font-semibold text-text-secondary">
              {label}
            </label>
            <Input
              id="text-prompt-value"
              autoFocus
              value={value}
              placeholder={placeholder}
              onChange={(e) => { setValue(e.target.value); setTouchedEmpty(false); }}
            />
            {touchedEmpty && <p className="text-xs text-error">{emptyMessage}</p>}
          </div>
        </div>

        <div className="flex gap-2 px-5 py-4 border-t border-border">
          <button
            type="submit"
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white bg-accent disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Guardando…" : confirmLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border border-border text-text-secondary cursor-pointer"
          >
            Cancelar
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
