"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, Loader2 } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "loading";

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  /** ms; 0 = no auto-dismiss (para loading que se actualiza) */
  duration?: number;
}

interface ToastContextValue {
  /** Muestra una notificación y devuelve su id (para actualizar/cerrar). */
  notify: (t: Omit<ToastItem, "id">) => string;
  success: (title: string, message?: string) => string;
  error: (title: string, message?: string) => string;
  info: (title: string, message?: string) => string;
  loading: (title: string, message?: string) => string;
  /** Reemplaza una notificación existente (ej. loading → success). */
  update: (id: string, t: Omit<ToastItem, "id">) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const STYLES: Record<ToastType, { bg: string; border: string; color: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }> = {
  success: { bg: "var(--success-subtle)", border: "var(--success-border)", color: "var(--success)", Icon: CheckCircle2 },
  error:   { bg: "var(--error-subtle)", border: "var(--error-border)", color: "var(--error)", Icon: AlertCircle },
  info:    { bg: "var(--info-subtle)", border: "var(--info-border)", color: "var(--info-strong)", Icon: Info },
  loading: { bg: "var(--surface)", border: "var(--border)", color: "var(--text-secondary)", Icon: Loader2 },
};

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    if (timers.current[id]) { clearTimeout(timers.current[id]); delete timers.current[id]; }
  }, []);

  const schedule = useCallback((id: string, duration: number) => {
    if (timers.current[id]) clearTimeout(timers.current[id]);
    if (duration > 0) {
      timers.current[id] = setTimeout(() => dismiss(id), duration);
    }
  }, [dismiss]);

  const notify = useCallback((t: Omit<ToastItem, "id">) => {
    const id = `t${++counter}`;
    const duration = t.duration ?? (t.type === "error" ? 5000 : t.type === "loading" ? 0 : 3500);
    setToasts((prev) => [...prev, { ...t, id }]);
    schedule(id, duration);
    return id;
  }, [schedule]);

  const update = useCallback((id: string, t: Omit<ToastItem, "id">) => {
    const duration = t.duration ?? (t.type === "error" ? 5000 : t.type === "loading" ? 0 : 3500);
    setToasts((prev) => prev.map((x) => (x.id === id ? { ...t, id } : x)));
    schedule(id, duration);
  }, [schedule]);

  const success = useCallback((title: string, message?: string) => notify({ type: "success", title, message }), [notify]);
  const error = useCallback((title: string, message?: string) => notify({ type: "error", title, message }), [notify]);
  const info = useCallback((title: string, message?: string) => notify({ type: "info", title, message }), [notify]);
  const loading = useCallback((title: string, message?: string) => notify({ type: "loading", title, message }), [notify]);

  useEffect(() => () => { Object.values(timers.current).forEach(clearTimeout); }, []);

  return (
    <ToastContext.Provider value={{ notify, success, error, info, loading, update, dismiss }}>
      {children}
      {/* En móvil el toast flota sobre la tab bar (var(--tabbar-total)); si quedara en
          bottom-4, la barra lo taparía junto con su botón de cerrar. */}
      <div className="fixed bottom-[calc(var(--tabbar-total)+0.5rem)] lg:bottom-4 right-3 lg:right-4 z-100 flex flex-col gap-2 w-[min(92vw,360px)] pointer-events-none">
        {toasts.map((t) => {
          const s = STYLES[t.type];
          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex gap-2.5 rounded-2xl border px-3.5 py-3 shadow-lg animate-[toastIn_0.18s_ease-out] ${t.message ? "items-start" : "items-center"}`}
              style={{ backgroundColor: s.bg, borderColor: s.border }}
              role="status"
            >
              <s.Icon className={`w-5 h-5 shrink-0 ${t.message ? "mt-0.5" : ""} ${t.type === "loading" ? "animate-spin" : ""}`} style={{ color: s.color }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-snug" style={{ color: s.color }}>{t.title}</p>
                {t.message && <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--text-secondary)" }}>{t.message}</p>}
              </div>
              <button onClick={() => dismiss(t.id)} className="shrink-0 p-0.5 rounded-lg hover:bg-black/5">
                <X className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />
              </button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toastIn{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}`}</style>
    </ToastContext.Provider>
  );
}

/** Hook para disparar notificaciones. Lanza si no hay ToastProvider en el árbol. */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
