"use client";

import { useEffect } from "react";

/**
 * Bloquea el scroll del fondo mientras un overlay está abierto, conservando la posición.
 *
 * En iOS `overflow: hidden` a secas no alcanza: el body igual scrollea por detrás del
 * overlay y, peor, al cerrar salta al tope. Por eso se fija el body con `position: fixed`
 * y `top` negativo, y al cerrar se restaura la posición exacta.
 *
 * Compartido por `Sheet` y `ModalShell` — si hubiera overlays anidados, solo el primero
 * toma el lock (el body ya está fixed y el segundo no lo pisa).
 */
export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const body = document.body;
    // Overlay anidado: otro ya fijó el body; no tocar nada para no perder su `top`.
    if (body.style.position === "fixed") return;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      window.scrollTo(0, scrollY);
    };
  }, [locked]);
}
