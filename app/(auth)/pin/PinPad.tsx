"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Delete, Monitor } from "lucide-react";
import { Card } from "@/components/ui";
import { api } from "@/lib/client/api";
import { safeNext } from "@/lib/auth/home";
import { initials, solidColor } from "@/lib/colors";
import { roleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";

type U = { id: string; name: string; role: string; color: string };

/**
 * Cambio de usuario en una terminal compartida: tocar tu nombre y poner tu
 * PIN de 4 números. En un turno cargado esto tiene que llevar dos segundos.
 */
export function PinPad({ users, deviceName, orgName, next }: { users: U[]; deviceName: string; orgName: string; next: string | null }) {
  const [selected, setSelected] = useState<U | null>(users.length === 1 ? users[0]! : null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  useEffect(() => {
    if (pin.length !== 4 || !selected || busy) return;
    setBusy(true);
    api<{ home: string }>("/api/auth/pin", { body: { userId: selected.id, pin } })
      .then((r) => {
        window.location.href = safeNext(next) ?? r.home;
      })
      .catch((e: Error) => {
        setError(e.message);
        setPin("");
        setShake((n) => n + 1);
        setBusy(false);
      });
  }, [pin, selected, busy, next]);

  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (/^\d$/.test(e.key)) setPin((p) => (p.length < 4 ? p + e.key : p));
      else if (e.key === "Backspace") setPin((p) => p.slice(0, -1));
      else if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  if (!selected) {
    return (
      <div className="w-full max-w-2xl">
        <div className="text-center mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-text-primary">¿Quién sos?</h1>
          <p className="text-sm text-text-secondary mt-1 flex items-center justify-center gap-1.5">
            <Monitor className="w-4 h-4" /> {orgName} · {deviceName}
          </p>
        </div>
        {users.length === 0 ? (
          <Card className="text-center text-sm text-text-secondary">
            Todavía no hay empleados con PIN. El dueño los carga en Configuración › Usuarios.
            <div className="mt-3">
              <Link href="/login" className="font-medium text-accent hover:underline">Entrar con email</Link>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 fs-stagger">
            {users.map((u) => (
              <button
                key={u.id}
                onClick={() => {
                  setSelected(u);
                  setError(null);
                }}
                className="fs-press flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-4 hover:border-border-strong hover:bg-surface-secondary transition-colors"
              >
                <span className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-semibold text-white" style={{ background: solidColor(u.color) }}>
                  {initials(u.name)}
                </span>
                <span className="text-sm font-semibold text-text-primary text-center leading-tight">{u.name}</span>
                <span className="text-xs text-text-muted">{roleLabel(u.role)}</span>
              </button>
            ))}
          </div>
        )}
        <div className="text-center mt-6">
          <Link href="/login" className="text-sm font-medium text-accent hover:underline">Entrar con email y contraseña</Link>
        </div>
      </div>
    );
  }

  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];
  return (
    <div className="w-full max-w-xs">
      <button onClick={() => { setSelected(null); setPin(""); setError(null); }} className="flex items-center gap-1 text-sm font-medium text-text-secondary hover:text-text-primary mb-4">
        <ChevronLeft className="w-4 h-4" /> Cambiar de persona
      </button>
      <div className="flex flex-col items-center mb-6">
        <span className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold text-white mb-2" style={{ background: solidColor(selected.color) }}>
          {initials(selected.name)}
        </span>
        <p className="font-semibold text-text-primary">{selected.name}</p>
        <div key={shake} className={cn("flex gap-3 mt-4", shake > 0 && "fs-shake")}>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("w-3.5 h-3.5 rounded-full border-2 transition-colors", i < pin.length ? "bg-accent border-accent" : "border-border-strong")} />
          ))}
        </div>
        <p className={cn("text-sm mt-3 h-5", error ? "text-error" : "text-text-muted")}>{error ?? "Ingresá tu PIN"}</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {keys.map((k) => (
          <PadKey key={k} onClick={() => setPin((p) => (p.length < 4 ? p + k : p))} disabled={busy}>
            {k}
          </PadKey>
        ))}
        <span />
        <PadKey onClick={() => setPin((p) => (p.length < 4 ? p + "0" : p))} disabled={busy}>0</PadKey>
        <PadKey onClick={() => setPin((p) => p.slice(0, -1))} disabled={busy} aria-label="Borrar">
          <Delete className="w-6 h-6" />
        </PadKey>
      </div>
    </div>
  );
}

function PadKey({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className="fs-press h-16 rounded-2xl border border-border bg-surface text-2xl font-semibold text-text-primary flex items-center justify-center hover:bg-surface-secondary active:bg-accent-light disabled:opacity-50 tabular-nums"
    >
      {children}
    </button>
  );
}
