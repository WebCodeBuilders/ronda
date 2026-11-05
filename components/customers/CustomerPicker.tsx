"use client";

import { useEffect, useState } from "react";
import { Search, UserRound, X } from "lucide-react";
import { api } from "@/lib/client/api";
import { formatCurrency, cn } from "@/lib/utils";

export type PickedCustomer = { id: string; name: string; phone?: string | null; address?: string | null; notes?: string | null; balance: number; creditLimit: number };

/** Buscar un cliente por nombre o teléfono; si no existe, crearlo ahí mismo. */
export function CustomerPicker({ value, onChange, allowCreate = true }: { value: PickedCustomer | null; onChange: (c: PickedCustomer | null) => void; allowCreate?: boolean }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<PickedCustomer[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api<{ customers: PickedCustomer[] }>(`/api/customers?q=${encodeURIComponent(q)}`).then((r) => setResults(r.customers)).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q, open]);

  async function create() {
    const name = q.trim();
    if (!name) return;
    setCreating(true);
    const isPhone = /^[\d\s+-]{6,}$/.test(name);
    try {
      const r = await api<{ customer: PickedCustomer }>("/api/customers", { body: isPhone ? { name: "Cliente", phone: name } : { name } });
      onChange(r.customer);
      setOpen(false);
      setQ("");
    } finally {
      setCreating(false);
    }
  }

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface px-3 py-2">
        <UserRound className="w-4 h-4 text-text-muted shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary truncate">{value.name}</p>
          <p className="text-xs text-text-muted truncate">{[value.phone, value.balance > 0 ? `debe ${formatCurrency(value.balance)}` : null].filter(Boolean).join(" · ")}</p>
        </div>
        <button onClick={() => onChange(null)} className="w-8 h-8 rounded-xl flex items-center justify-center text-text-muted hover:bg-surface-secondary" aria-label="Quitar cliente"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search className="absolute left-3 top-3.5 w-4 h-4 text-text-muted pointer-events-none" />
      <input
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Nombre o teléfono"
        className="w-full h-11 pl-9 pr-3 rounded-2xl border border-border bg-surface text-base lg:text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      {open && (q || results.length > 0) && (
        <div className="mt-1.5 rounded-2xl border border-border bg-surface divide-y divide-border max-h-56 overflow-y-auto scroll-contain">
          {results.map((c) => (
            <button key={c.id} onClick={() => { onChange(c); setOpen(false); setQ(""); }} className="w-full text-left px-3 py-2.5 hover:bg-surface-secondary">
              <p className="text-sm font-semibold text-text-primary">{c.name}</p>
              <p className="text-xs text-text-muted">{[c.phone, c.address].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
            </button>
          ))}
          {allowCreate && q.trim() && (
            <button onClick={create} disabled={creating} className={cn("w-full flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-accent hover:bg-surface-secondary", creating && "opacity-60")}>
              Crear cliente "{q.trim()}"
            </button>
          )}
        </div>
      )}
    </div>
  );
}
