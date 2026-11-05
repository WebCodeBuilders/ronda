"use client";

import Link from "next/link";
import { ArrowLeft, RotateCcw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";

type Tone = "error" | "warning" | "neutral";

const TONES: Record<Tone, { tile: string; icon: string }> = {
  error: { tile: "bg-error-light", icon: "text-error-strong" },
  warning: { tile: "bg-warning-light", icon: "text-warning-strong" },
  neutral: { tile: "bg-surface-secondary", icon: "text-text-secondary" },
};

interface ErrorPanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  /**
   * El `digest` que manda el servidor. En producción Next NO envía el mensaje real
   * del error (evita filtrar datos del comercio), así que este hash es lo ÚNICO que
   * cruza lo que vio la persona con la línea del log. Por eso se muestra, en
   * monoespaciado y seleccionable: es el dato que va a pedir soporte.
   */
  digest?: string;
  /** Reintenta el render del segmento. Sin esto no se ofrece el botón. */
  onRetry?: () => void;
  backHref?: string;
  backLabel?: string;
  tone?: Tone;
}

/**
 * Pantalla de error / no encontrado. Vive en un solo lugar porque son cinco
 * boundaries (global, tenant, admin, login y el 404) y cinco copias del mismo
 * bloque se despegan a la primera corrección.
 *
 * Mismo esqueleto que `EmptyState` a propósito: el usuario ya vio esa forma en
 * las listas vacías, y que un error se parezca a algo conocido lo hace menos
 * alarmante que una pantalla que no se parece a nada de la app.
 */
export function ErrorPanel({
  icon: Icon,
  title,
  description,
  digest,
  onRetry,
  backHref,
  backLabel = "Volver al inicio",
  tone = "error",
}: ErrorPanelProps) {
  const t = TONES[tone];

  return (
    <div className="fs-fade-in flex flex-col items-center justify-center py-14 lg:py-20 px-4 text-center">
      <div className={`w-14 h-14 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center mb-4 ${t.tile}`}>
        <Icon className={`w-7 h-7 lg:w-8 lg:h-8 ${t.icon}`} />
      </div>

      <h1 className="text-lg lg:text-xl font-semibold mb-1.5 text-text-primary">{title}</h1>
      <p className="text-sm mb-5 max-w-md text-text-secondary">{description}</p>

      <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
        {/* Link estilado como botón, no un <Button> adentro de un <Link>: anidar
            un botón en un ancla es HTML inválido y rompe la navegación por teclado. */}
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold px-5 py-2.5 min-h-11 lg:min-h-0 rounded-2xl border border-border bg-surface text-text-primary hover:bg-surface-secondary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:ring-offset-1"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            {backLabel}
          </Link>
        )}
        {onRetry && (
          <Button onClick={onRetry} icon={<RotateCcw className="w-4 h-4 shrink-0" />}>
            Reintentar
          </Button>
        )}
      </div>

      {digest && (
        <p className="mt-6 text-xs text-text-muted">
          Código del error:{" "}
          <span className="font-mono select-all text-text-secondary">{digest}</span>
        </p>
      )}
    </div>
  );
}
