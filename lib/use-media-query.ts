"use client";

import { useSyncExternalStore } from "react";

/**
 * Hooks de breakpoint.
 *
 * ⚠️ REGLA IMPORTANTE — leer antes de usarlos:
 *
 * El servidor no sabe el ancho de pantalla. Estos hooks devuelven `false` en SSR y en el
 * primer render del cliente, y recién en la hidratación pasan al valor real. Si de eso
 * depende QUÉ se renderiza, el usuario móvil ve un frame de desktop → layout shift.
 *
 * Por eso:
 *
 * 1. Para LAYOUT (qué se ve y cómo se acomoda) → usar SIEMPRE clases de Tailwind
 *    (`hidden lg:flex`, `grid-cols-1 lg:grid-cols-4`). El CSS resuelve en el primer paint,
 *    sin JS y sin shift. Es el 90% del trabajo responsive.
 *
 * 2. Para COMPORTAMIENTO que el CSS no puede expresar → usar estos hooks. Son seguros
 *    cuando lo que controlan aparece DESPUÉS de una interacción del usuario (o sea, ya
 *    hidratado): abrir un `Select` como sheet en vez de dropdown, activar drag-to-dismiss,
 *    elegir el destino de un portal. En esos casos no hay shift posible porque en el
 *    primer paint no había nada renderizado.
 *
 * Si necesitás el valor real antes de pintar algo estructural, la respuesta correcta casi
 * siempre es mover esa decisión a CSS, no esperar al hook.
 */

/** Breakpoints de Tailwind (px). `lg` es la frontera móvil/tablet ↔ desktop en esta app. */
export const BREAKPOINTS = {
  xs: 416,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

const serverSnapshot = () => false;

/**
 * Caché por query de la MediaQueryList y de sus callbacks.
 *
 * Es necesaria, no una optimización: `useSyncExternalStore` vuelve a suscribirse cada vez
 * que la identidad de `subscribe` cambia. Creando las funciones al vuelo en el cuerpo del
 * hook, se desuscribiría y resuscribiría en CADA render. Cacheadas por string de query,
 * la identidad es estable y la suscripción se hace una sola vez.
 */
const cache = new Map<
  string,
  { subscribe: (cb: () => void) => () => void; getSnapshot: () => boolean }
>();

function entryFor(query: string) {
  let entry = cache.get(query);
  if (!entry) {
    const mql = window.matchMedia(query);
    entry = {
      subscribe: (cb) => {
        mql.addEventListener("change", cb);
        return () => mql.removeEventListener("change", cb);
      },
      getSnapshot: () => mql.matches,
    };
    cache.set(query, entry);
  }
  return entry;
}

// En SSR no existe `window`: se devuelven stubs y el snapshot de servidor (`false`).
const noopSubscribe = () => () => {};

/**
 * Suscripción a una media query. Devuelve `false` en servidor y primer render.
 * `query` debe ser una constante (no un template armado en cada render).
 */
export function useMediaQuery(query: string): boolean {
  const isBrowser = typeof window !== "undefined";
  const entry = isBrowser ? entryFor(query) : null;
  return useSyncExternalStore(
    entry?.subscribe ?? noopSubscribe,
    entry?.getSnapshot ?? serverSnapshot,
    serverSnapshot,
  );
}

/** `true` bajo 1024px — celular y tablet vertical. Coincide con el `lg:` del shell. */
export function useIsMobile(): boolean {
  return useMediaQuery(`(max-width: ${BREAKPOINTS.lg - 1}px)`);
}

/** `true` entre 640px y 1023px — tablet vertical / celular grande. */
export function useIsTablet(): boolean {
  return useMediaQuery(
    `(min-width: ${BREAKPOINTS.sm}px) and (max-width: ${BREAKPOINTS.lg - 1}px)`,
  );
}

/** `true` en dispositivos sin puntero fino (dedo). Ortogonal al ancho: una tablet
 *  grande puede ser ≥1024px y aun así necesitar targets táctiles. */
export function useIsTouch(): boolean {
  return useMediaQuery("(pointer: coarse)");
}

/** `true` si el usuario pidió reducir animaciones. El CSS ya lo respeta globalmente
 *  (ver globals.css); esto es para animaciones controladas por JS. */
export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

/** `true` recién después de la hidratación. Para diferir render que depende del cliente. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}
