import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BackButton } from "./BackButton";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /**
   * Junto al título, en la misma línea: un chip de estado o de modo ("Flujo: Con
   * Depósito", "Activo"). Existe porque, sin dónde ponerlo, varias pantallas
   * escribían su propio `h1` y en el celular los botones se salían de la pantalla.
   */
  meta?: React.ReactNode;
  /** "Volver" con el NOMBRE del destino, arriba del título (`BackButton`). */
  back?: { href: string; label: string };
  /**
   * @deprecated Flecha sola sin decir a dónde vuelve. Usar `back`.
   */
  backHref?: string;
}

/**
 * Encabezado de página. NO lleva botón de ayuda: la guía de cada pantalla vive
 * en un único botón del header, junto al buscador global, y su contenido sale
 * de `lib/page-help.ts` según la ruta. Así la ayuda está siempre en el mismo
 * lugar en vez de en 18 posiciones distintas.
 */
export function PageHeader({ title, description, action, meta, back, backHref }: PageHeaderProps) {
  return (
    <>
      {back && <BackButton href={back.href} label={back.label} />}
      {/* Móvil: título arriba y acciones abajo a lo ancho (un botón flotando a la derecha
          de un título largo se corta). En ≥sm, la fila de siempre. */}
      <div className="flex flex-col gap-3 mb-4 sm:mb-6 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          {backHref && !back && (
            <Link
              href={backHref}
              aria-label="Volver"
              className="p-2 rounded-xl border border-border text-text-secondary hover:bg-surface-secondary shrink-0 mt-0.5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">{title}</h1>
              {meta}
            </div>
            {description && <p className="text-sm mt-1 text-text-secondary">{description}</p>}
          </div>
        </div>
        {/* `*:flex-1` reparte las acciones a lo ancho en móvil (targets grandes);
            en ≥sm vuelven a su tamaño natural. `flex-wrap`: si no entran, bajan de
            renglón en vez de salirse de la pantalla. */}
        {action && <div className="flex flex-wrap items-center gap-2 *:flex-1 sm:shrink-0 sm:*:flex-none">{action}</div>}
      </div>
    </>
  );
}
