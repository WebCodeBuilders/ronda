"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BREAKPOINTS, useHasMounted, useMediaQuery } from "@/lib/use-media-query";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Título del encabezado fijo. Si se omite, no se renderiza la barra superior. */
  title?: React.ReactNode;
  /** Texto secundario bajo el título. */
  description?: React.ReactNode;
  /** Contenido fijo al pie (botones de acción). Queda sobre la safe area. */
  footer?: React.ReactNode;
  /** Acciones del encabezado, a la izquierda del botón de cerrar. */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
  /** Ancho máximo en desktop. En móvil siempre ocupa todo el ancho. */
  maxWidth?: string;
  /**
   * `auto` (default) → sheet inferior en móvil, modal centrado en ≥1024px.
   * `sheet` → siempre sheet inferior. `modal` → siempre modal centrado.
   */
  variant?: "auto" | "sheet" | "modal";
  /** Ocupa toda la altura disponible en vez de ajustarse al contenido. */
  fullHeight?: boolean;
  /** Oculta la X de cerrar. */
  hideClose?: boolean;
  /** Bloquea el cierre por overlay/Escape/arrastre (procesos que no deben interrumpirse). */
  dismissible?: boolean;
  className?: string;
}

/** Sheet inferior SOLO bajo 640px — el MISMO corte que ModalShell y que `fs-modal-in`
 *  (sheet en celular, modal centrado de ahí en más). Antes cortaba en 1024px y entre
 *  640 y 1023px (tablet vertical / ventana achicada) este era el único modal de la app
 *  pegado al borde inferior, sin cierre visual abajo. */
const SHEET_QUERY = `(max-width: ${BREAKPOINTS.sm - 1}px)`;

/** Píxeles arrastrados a partir de los cuales se cierra al soltar. */
const DISMISS_PX = 96;
/** Velocidad (px/ms) que cierra aunque no se haya llegado al umbral. */
const DISMISS_VELOCITY = 0.5;

/**
 * Contenedor de overlay táctil.
 *
 * Resuelve de raíz los tres problemas de `ModalShell` en móvil:
 * - **Nada cortado**: `max-h-[90dvh]` con encabezado y pie fijos y SOLO el cuerpo scrolleando.
 * - **Sin scrolls raros**: `overscroll-contain` en el cuerpo + bloqueo del scroll de fondo.
 * - **Safe area**: el pie nunca queda bajo la barra gestual de iOS.
 *
 * Además: arrastrar hacia abajo desde el encabezado lo cierra, con seguimiento del dedo.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  footer,
  headerActions,
  children,
  maxWidth = "max-w-lg",
  variant = "auto",
  fullHeight = false,
  hideClose = false,
  dismissible = true,
  className,
}: SheetProps) {
  const mounted = useHasMounted();
  const isMobile = useMediaQuery(SHEET_QUERY);
  const panelRef = useRef<HTMLDivElement>(null);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef<{ y: number; t: number } | null>(null);

  // Reinicio del arrastre al abrir. Va en render (patrón oficial de React para "ajustar
  // estado cuando cambia una prop") y no en un efecto: así el panel nunca llega a pintarse
  // un frame con el desplazamiento del cierre anterior.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDragY(0);
  }

  // Es sheet (sube desde abajo) o modal centrado. `isMobile` solo se consulta cuando ya
  // hubo interacción del usuario → el panel no existía en el primer paint, no hay shift.
  const asSheet = variant === "sheet" || (variant === "auto" && isMobile);

  const requestClose = useCallback(() => {
    if (!dismissible) return;
    onClose();
  }, [dismissible, onClose]);

  // Escape.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  // Bloqueo del scroll de fondo conservando la posición (compartido con ModalShell).
  useBodyScrollLock(open);

  // Foco inicial dentro del panel (accesibilidad + evita que el teclado siga en el fondo).
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const panel = panelRef.current;
      if (!panel) return;
      const target = panel.querySelector<HTMLElement>(
        "[data-autofocus], input:not([type='hidden']):not([disabled]), textarea:not([disabled]), button:not([disabled])",
      );
      // `preventScroll` para que enfocar no desplace el cuerpo del sheet.
      target?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  // ── Arrastre para cerrar (solo en modo sheet y desde el encabezado) ──
  function onDragStart(e: React.PointerEvent) {
    if (!asSheet || !dismissible) return;
    dragStart.current = { y: e.clientY, t: Date.now() };
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onDragMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    // Solo hacia abajo; hacia arriba se amortigua para que se sienta elástico.
    const delta = e.clientY - dragStart.current.y;
    setDragY(delta > 0 ? delta : delta / 4);
  }

  function onDragEnd(e: React.PointerEvent) {
    const start = dragStart.current;
    dragStart.current = null;
    setDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!start) return;
    const delta = e.clientY - start.y;
    const velocity = delta / Math.max(1, Date.now() - start.t);
    if (delta > DISMISS_PX || velocity > DISMISS_VELOCITY) {
      requestClose();
    } else {
      setDragY(0); // vuelve a su lugar
    }
  }

  if (!mounted || !open) return null;

  const hasHeader = Boolean(title) || Boolean(headerActions) || (!hideClose && dismissible);

  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-center fs-overlay-in",
        asSheet ? "items-end" : "items-center p-4",
      )}
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={requestClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative flex flex-col w-full bg-surface shadow-2xl",
          // El alto máximo + el cuerpo scrolleable es lo que impide que se corte.
          asSheet
            ? "rounded-t-3xl max-h-[92dvh] fs-sheet-up"
            : cn("rounded-2xl max-h-[90dvh] fs-fade-scale", maxWidth),
          asSheet && fullHeight && "h-[92dvh]",
          !asSheet && fullHeight && "h-[90dvh]",
          className,
        )}
        style={
          asSheet
            ? {
                transform: dragY ? `translateY(${Math.max(0, dragY)}px)` : undefined,
                // Durante el arrastre no hay transición: el panel sigue al dedo 1:1.
                transition: dragging ? "none" : "transform var(--dur-base) var(--ease-out-expo)",
              }
            : undefined
        }
      >
        {/* Encabezado fijo. En modo sheet es además la zona de arrastre. */}
        {hasHeader && (
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            className={cn(
              "shrink-0 border-b border-border",
              asSheet && dismissible && "cursor-grab active:cursor-grabbing touch-none",
            )}
          >
            {/* Barra de agarre: señal visual de que se puede arrastrar. */}
            {asSheet && dismissible && (
              <div className="flex justify-center pt-2.5 pb-1">
                <span className="h-1 w-9 rounded-2xl bg-border-strong" />
              </div>
            )}
            <div className={cn("flex items-start gap-3 px-4", asSheet ? "pb-3 pt-1" : "py-3.5")}>
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 className="truncate text-base font-semibold text-text-primary">{title}</h2>
                )}
                {description && (
                  <p className="mt-0.5 text-xs text-text-secondary">{description}</p>
                )}
              </div>
              {/* Acciones + cerrar: el cerrar siempre último (borde derecho), las
                  acciones a su izquierda. `touch-auto` las saca de la zona de arrastre
                  del encabezado, si no el primer toque se interpreta como gesto. */}
              {(headerActions || (!hideClose && dismissible)) && (
                <div className="-mt-1 flex shrink-0 items-center gap-1 touch-auto">
                  {headerActions}
                  {!hideClose && dismissible && (
                    <button
                      type="button"
                      onClick={requestClose}
                      aria-label="Cerrar"
                      className="tap-44 -mr-2 flex shrink-0 items-center justify-center rounded-2xl text-text-muted transition-colors hover:bg-surface-secondary hover:text-text-primary"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cuerpo: el ÚNICO que scrollea. `scroll-contain` evita arrastrar el fondo. */}
        <div className="scroll-contain min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-3">
          {children}
        </div>

        {/* Pie fijo, siempre por encima de la barra gestual. */}
        {footer && (
          <div
            className="shrink-0 border-t border-border bg-surface px-4 pt-3 lg:rounded-b-2xl"
            style={{ paddingBottom: "calc(0.75rem + var(--sa-bottom))" }}
          >
            {footer}
          </div>
        )}

        {/* Sin pie, el sheet igual respeta la safe area inferior. */}
        {!footer && asSheet && <div style={{ height: "var(--sa-bottom)" }} className="shrink-0" />}
      </div>
    </div>,
    document.body,
  );
}
