"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { cn } from "@/lib/utils";

interface ModalShellProps {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
  overlayOpacity?: string;
  /** Mantenido por compatibilidad: hoy TODO modal es bottom-sheet bajo 640px. */
  align?: "center" | "bottom";
  /** Muestra el botón de cierre estándar (X) SIEMPRE arriba a la derecha. */
  showClose?: boolean;
  /**
   * `false`: el cuerpo no scrollea; los hijos (columna flex) eligen qué parte se
   * desplaza. Lo usa la ventana de pedido para dejar su pie fijo y a la vista.
   */
  bodyScroll?: boolean;
  /** Clases extra del panel (pisan las de alto, p. ej. una ventana de alto fijo). */
  panelClassName?: string;
}

function subscribe() { return () => {}; }

/** Píxeles de arrastre que cierran el sheet al soltar (o velocidad equivalente). */
const DISMISS_PX = 96;
const DISMISS_VELOCITY = 0.5;

/**
 * Contenedor genérico de modal. Los hijos traen su propio layout/padding.
 *
 * Comportamiento móvil (<640px): SIEMPRE bottom-sheet — sube desde abajo, con barra de
 * agarre arrastrable para cerrar, tope de alto `92dvh` y **scroll interno**: el contenido
 * que no entra scrollea dentro del panel en vez de quedar cortado por el borde de la
 * pantalla (el bug histórico de esta app en celular). En ≥640px, modal centrado idéntico
 * al de siempre.
 */
export function ModalShell({
  onClose,
  children,
  maxWidth = "max-w-md",
  overlayOpacity = "rgba(0,0,0,0.5)",
  align = "center",
  showClose = false,
  bodyScroll = true,
  panelClassName,
}: ModalShellProps) {
  const isClient = useSyncExternalStore(subscribe, () => true, () => false);

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; t: number } | null>(null);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Sin esto, el gesto de scroll dentro del modal arrastraba también la página de fondo.
  useBodyScrollLock(isClient);

  // ── Arrastre para cerrar (la barra de agarre solo existe bajo 640px) ──
  function onDragStart(e: React.PointerEvent) {
    dragStart.current = { y: e.clientY, t: Date.now() };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onDragMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const delta = e.clientY - dragStart.current.y;
    setDragY(delta > 0 ? delta : delta / 4); // hacia arriba, elástico
  }
  function onDragEnd(e: React.PointerEvent) {
    const start = dragStart.current;
    dragStart.current = null;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!start) return;
    const delta = e.clientY - start.y;
    const velocity = delta / Math.max(1, Date.now() - start.t);
    if (delta > DISMISS_PX || velocity > DISMISS_VELOCITY) onClose();
    else setDragY(0);
  }

  if (!isClient) return null;

  // `align` se conserva en la firma por los call sites existentes, pero ya no cambia el
  // resultado: el comportamiento (sheet en celular / centrado en ≥sm) es el mismo para
  // ambos valores desde la adaptación móvil.
  void align;

  return createPortal(
    <div
      className="fs-overlay-in fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      style={{ backgroundColor: overlayOpacity }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fs-modal-in relative flex w-full flex-col shadow-2xl",
          // `overflow-hidden` recorta los hijos a las esquinas redondeadas (como el
          // ModalShell original); el scroll vive en el cuerpo, no acá.
          "overflow-hidden rounded-t-3xl sm:rounded-2xl",
          // El tope de alto + scroll interno es lo que garantiza que nada quede cortado.
          "max-h-[92dvh] sm:max-h-[90dvh]",
          maxWidth,
          panelClassName,
        )}
        style={{
          backgroundColor: "var(--surface)",
          transform: dragY ? `translateY(${Math.max(0, dragY)}px)` : undefined,
          transition: dragging ? "none" : "transform var(--dur-base) var(--ease-out-expo)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de agarre: solo celular. `touch-none` para que el arrastre no dispute
            con el scroll del contenido. */}
        <div
          className="flex shrink-0 cursor-grab justify-center pt-2.5 pb-1 active:cursor-grabbing touch-none sm:hidden"
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          <span className="h-1 w-9 rounded-2xl bg-border-strong" />
        </div>

        {showClose && (
          <button
            onClick={onClose}
            aria-label="Cerrar"
            // `h-11 w-11` en vez de `tap-44`: `tap-44` es una clase sin capa que fija
            // `position: relative` y le gana a `absolute` (utilities), lo que sacaba la X
            // del flujo y la mostraba centrada arriba en vez de en la esquina.
            className="absolute top-1 right-1 z-10 flex h-11 w-11 items-center justify-center rounded-2xl transition-colors hover:bg-black/5 sm:top-2 sm:right-2"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Cuerpo: el ÚNICO que scrollea (salvo `bodyScroll={false}`). Los hijos conservan su propio padding. */}
        <div className={cn("min-h-0 flex-1", bodyScroll ? "scroll-contain overflow-y-auto overflow-x-hidden" : "flex flex-col overflow-hidden")}>
          {children}
        </div>

        {/* Safe area: el contenido nunca queda bajo la barra gestual de iOS. */}
        <div className="shrink-0 sm:hidden" style={{ height: "var(--sa-bottom)" }} />
      </div>
    </div>,
    document.body,
  );
}
