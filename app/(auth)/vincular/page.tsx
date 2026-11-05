"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/client/api";

export default function PairPage() {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ next: string }>("/api/auth/pair", { body: { code } });
      window.location.href = r.next;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <Card>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">Vincular equipo</h1>
        <p className="text-sm text-text-secondary mt-1 mb-5">
          En la compu principal entrá a <b>Configuración › Equipos</b>, creá el equipo y escribí acá el código de 6 números.
          Se hace una sola vez.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <Input
            label="Código"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center text-2xl tracking-[0.5em] font-semibold tabular-nums"
            error={error ?? undefined}
            required
          />
          <Button type="submit" fullWidth loading={loading} disabled={code.length !== 6}>
            Vincular
          </Button>
        </form>
      </Card>
      <Link href="/login" className="block text-center text-sm font-medium text-accent hover:underline py-2">
        Entrar con email
      </Link>
    </div>
  );
}
