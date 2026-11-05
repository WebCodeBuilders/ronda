"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeEvent, RealtimeEventType } from "./events";

/**
 * Una sola conexión SSE por pestaña, compartida por todos los componentes.
 * Expone si está conectada (para el indicador "En vivo / Reconectando").
 */

type Listener = (ev: RealtimeEvent) => void;
const listeners = new Set<Listener>();
const statusListeners = new Set<() => void>();
let source: EventSource | null = null;
let connected = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

function setConnected(v: boolean) {
  if (connected === v) return;
  connected = v;
  statusListeners.forEach((l) => l());
}

function open() {
  if (source || typeof window === "undefined") return;
  source = new EventSource("/api/stream");
  source.onopen = () => setConnected(true);
  source.onmessage = (msg) => {
    try {
      const ev = JSON.parse(msg.data) as RealtimeEvent | { type: "hello" };
      if (ev.type === "hello") {
        // Al reconectar, todo el mundo vuelve a pedir: pudimos perder avisos.
        if (wasDisconnected) listeners.forEach((l) => l({ type: "resync" }));
        wasDisconnected = false;
        return;
      }
      listeners.forEach((l) => l(ev as RealtimeEvent));
    } catch {
      /* ignorado */
    }
  };
  source.onerror = () => {
    setConnected(false);
    wasDisconnected = true;
    source?.close();
    source = null;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => {
      if (listeners.size > 0) open();
    }, 3000);
  };
}
let wasDisconnected = false;

export function useRealtime(handler: Listener) {
  const ref = useRef(handler);
  useEffect(() => {
    ref.current = handler;
  });
  useEffect(() => {
    const l: Listener = (ev) => ref.current(ev);
    listeners.add(l);
    open();
    return () => {
      listeners.delete(l);
    };
  }, []);
}

export function useRealtimeStatus(): boolean {
  return useSyncExternalStore(
    (cb) => {
      statusListeners.add(cb);
      return () => statusListeners.delete(cb);
    },
    () => connected,
    () => true,
  );
}

/**
 * Refresca la pantalla (los datos del servidor) cuando llega alguno de los
 * eventos indicados. Agrupa ráfagas: diez platos marcados juntos son UN refresco.
 * Además refresca cada `fallbackMs` por si el tiempo real estuviera caído.
 */
export function useLiveRefresh(types: RealtimeEventType[] | "all", fallbackMs = 30_000) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = types === "all" ? "all" : types.join(",");
  const [, force] = useState(0);
  useRealtime((ev) => {
    if (key !== "all" && ev.type !== "resync" && !key.split(",").includes(ev.type)) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      router.refresh();
      force((n) => n + 1);
    }, 150);
  });
  useEffect(() => {
    const id = setInterval(() => router.refresh(), fallbackMs);
    return () => clearInterval(id);
  }, [router, fallbackMs]);
}
