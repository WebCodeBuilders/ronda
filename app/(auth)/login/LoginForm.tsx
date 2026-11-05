"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Input } from "@/components/ui";
import { api } from "@/lib/client/api";
import { safeNext } from "@/lib/auth/home";

export function LoginForm({ next }: { next: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ home: string }>("/api/auth/login", { body: { email, password } });
      window.location.href = safeNext(next) ?? r.home;
    } catch (err) {
      setError((err as Error).message);
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-sm space-y-4">
      <Card>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">Entrar</h1>
        <p className="text-sm text-text-secondary mt-1 mb-5">Con tu email y contraseña de dueño o encargado.</p>
        <form onSubmit={submit} className="space-y-4">
          <Input label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required error={error ?? undefined} />
          <Button type="submit" fullWidth loading={loading}>
            Entrar
          </Button>
        </form>
      </Card>
      <Link href="/vincular" className="flex items-center justify-center gap-2 text-sm font-medium text-accent hover:underline py-2">
        Vincular este equipo (tablet de mozo, cocina, caja)
      </Link>
    </div>
  );
}
