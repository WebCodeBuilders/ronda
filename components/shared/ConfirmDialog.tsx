"use client";

import { X } from "lucide-react";
import { ModalShell } from "@/components/shared/ModalShell";
import { Button } from "@/components/ui";

// ─── CONFIRMACIÓN — UN SOLO LAYOUT PARA TODA LA APP ──────────────────────────
//
// Cabecera con título y X, cuerpo, y pie con la acción principal a la izquierda
// (ocupando el ancho sobrante) y "Volver" al final. Es el mismo esqueleto que
// usa la confirmación de cambio de estado del pedido (OrderStatusActions), que
// es el patrón de la casa.
//
// Existe porque cada pantalla se estaba escribiendo el suyo: la de Preparación
// tenía tres modales con los botones apilados a lo alto (uno debajo del otro,
// todos del mismo peso visual) y uno de ellos —despachar— estaba escrito DOS
// veces, en la tabla y en el panel del pedido, con textos distintos.

export interface ConfirmDialogProps {
  title: string;
  /** Cuerpo: qué va a pasar. Texto corto, en frases enteras. */
  children?: React.ReactNode;
  confirmLabel: string;
  confirmIcon?: React.ReactNode;
  /** `danger` pinta la acción principal en rojo (cancelar, borrar). */
  tone?: "primary" | "danger";
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Salida alternativa opcional (p. ej. "Salir sin guardar"). */
  secondary?: { label: string; onClick: () => void };
  cancelLabel?: string;
  maxWidth?: string;
}

export function ConfirmDialog({
  title, children, confirmLabel, confirmIcon, tone = "primary", loading = false,
  onConfirm, onClose, secondary, cancelLabel = "Volver", maxWidth = "max-w-md",
}: ConfirmDialogProps) {
  return (
    <ModalShell onClose={() => !loading && onClose()} maxWidth={maxWidth}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          aria-label="Cerrar"
          className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-black/5 disabled:opacity-40"
        >
          <X className="h-4 w-4" style={{ color: "var(--text-muted)" }} />
        </button>
      </div>

      {children && (
        <div className="space-y-3 px-5 py-4 text-sm leading-snug" style={{ color: "var(--text-secondary)" }}>
          {children}
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t px-5 py-4" style={{ borderColor: "var(--border)" }}>
        <Button
          size="md"
          variant={tone === "danger" ? "danger" : "primary"}
          loading={loading}
          icon={loading ? undefined : confirmIcon}
          onClick={onConfirm}
          className="min-w-[9rem] flex-1"
        >
          {confirmLabel}
        </Button>
        {secondary && (
          <Button size="md" variant="outline" disabled={loading} onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
        <Button size="md" variant="outline" disabled={loading} onClick={onClose}>
          {cancelLabel}
        </Button>
      </div>
    </ModalShell>
  );
}
