"use client";

import { useState } from "react";
import { Button, Card, Input, Select } from "@/components/ui";
import { api } from "@/lib/client/api";
import { KINDS } from "@/components/settings/BusinessSettings";

/** Alta del comercio la primera vez que se abre el sistema. */
export function SetupForm() {
  const [f, setF] = useState({ businessName: "", kind: "restaurant", ownerName: "", email: "", password: "", pin: "", tables: 12 });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ home: string }>("/api/setup", { body: f });
      window.location.href = r.home;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-lg">
      <Card>
        <h1 className="text-xl font-bold tracking-tight text-text-primary">Bienvenido a ronda</h1>
        <p className="text-sm text-text-secondary mt-1 mb-5">Cargá los datos de tu comercio. Dejamos armado un salón, la cocina, la barra y los medios de pago; todo se puede cambiar después.</p>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Nombre del comercio" value={f.businessName} onChange={(e) => set("businessName", e.target.value)} required />
            <Select label="Rubro" value={f.kind} onChange={(e) => set("kind", e.target.value)} options={KINDS} />
          </div>
          <Input label="Cantidad de mesas del salón" type="number" min={0} max={60} value={f.tables} onChange={(e) => set("tables", Math.max(0, Math.min(60, Number(e.target.value) || 0)))} hint="Después las acomodás en el plano y agregás terraza, barra o playa." />
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-semibold text-text-primary">Tu usuario (dueño)</p>
            <Input label="Tu nombre" value={f.ownerName} onChange={(e) => set("ownerName", e.target.value)} required />
            <Input label="Email" type="email" autoComplete="email" value={f.email} onChange={(e) => set("email", e.target.value)} required />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input label="Contraseña" type="password" autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} hint="8 caracteres o más" required />
              <Input label="PIN de 4 números" inputMode="numeric" maxLength={4} value={f.pin} onChange={(e) => set("pin", e.target.value.replace(/\D/g, ""))} hint="Para entrar rápido en las tablets" required />
            </div>
          </div>
          {error && <p className="text-sm text-error">{error}</p>}
          <Button type="submit" fullWidth size="lg" loading={busy}>Crear mi comercio</Button>
        </form>
      </Card>
    </div>
  );
}
