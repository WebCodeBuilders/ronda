"use client";

import { useEffect, useSyncExternalStore } from "react";

/**
 * Qué ítem del menú se marca cuando la ruta no alcanza para saberlo: un
 * pedido de mesa vive en /pedidos/[id] pero pertenece al Salón.
 */
let current: string | null = null;
const subs = new Set<() => void>();

function set(v: string | null) {
  current = v;
  subs.forEach((s) => s());
}

export function useActiveNavHref(): string | null {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    () => current,
    () => null,
  );
}

/** La pantalla dice a qué sección pertenece mientras está montada. */
export function useNavSection(href: string) {
  useEffect(() => {
    set(href);
    return () => set(null);
  }, [href]);
}
