"use client";

import { useState } from "react";
import { Button, Input, Sheet } from "@/components/ui";

/**
 * Autorización en el momento: el encargado pone su PIN en la terminal del
 * mozo, sin cambiar de sesión. Queda registrado quién autorizó.
 */
export function ManagerPinDialog({ title, onClose, onSubmit }: { title: string; onClose: () => void; onSubmit: (pin: string) => Promise<void> }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(pin);
    } catch (err) {
      setError((err as Error).message);
      setPin("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={`${title}: autorización`} description="Hace falta el PIN de un encargado." maxWidth="max-w-xs"
      footer={<Button fullWidth loading={busy} disabled={pin.length !== 4} onClick={() => submit()}>Autorizar</Button>}
    >
      <form onSubmit={submit}>
        <Input
          type="password"
          inputMode="numeric"
          autoFocus
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="text-center text-2xl tracking-[0.6em] font-semibold"
          error={error ?? undefined}
          aria-label="PIN del encargado"
        />
      </form>
    </Sheet>
  );
}
