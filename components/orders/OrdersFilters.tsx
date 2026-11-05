"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { Button, Input, Select } from "@/components/ui";
import { ORDER_STATUS_LABEL, ORDER_TYPE_LABEL } from "@/lib/orders/labels";

type F = { q?: string; estado?: string; tipo?: string; desde?: string; hasta?: string; mozo?: string };

export function OrdersFilters({ initial, waiters }: { initial: F; waiters: { id: string; name: string }[] }) {
  const router = useRouter();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const [f, setF] = useState<F>({ desde: today, hasta: today, ...initial });
  function apply(next: F) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
    router.push(`/pedidos?${p.toString()}`);
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); apply(f); }} className="flex flex-wrap items-end gap-2 mb-3">
      <div className="w-full sm:w-64"><Input icon={<Search />} placeholder="N° de pedido, cliente o mesa" value={f.q ?? ""} onChange={(e) => setF({ ...f, q: e.target.value })} /></div>
      <div className="w-36"><Input type="date" aria-label="Desde" value={f.desde ?? ""} onChange={(e) => setF({ ...f, desde: e.target.value })} /></div>
      <div className="w-36"><Input type="date" aria-label="Hasta" value={f.hasta ?? ""} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></div>
      <div className="w-40"><Select aria-label="Estado" value={f.estado ?? ""} placeholder="Todos los estados" onChange={(e) => apply({ ...f, estado: e.target.value })} options={Object.entries(ORDER_STATUS_LABEL).map(([value, label]) => ({ value, label }))} /></div>
      <div className="w-40"><Select aria-label="Tipo" value={f.tipo ?? ""} placeholder="Todos los tipos" onChange={(e) => apply({ ...f, tipo: e.target.value })} options={Object.entries(ORDER_TYPE_LABEL).map(([value, label]) => ({ value, label }))} /></div>
      <div className="w-40"><Select aria-label="Mozo" value={f.mozo ?? ""} placeholder="Todos los mozos" onChange={(e) => apply({ ...f, mozo: e.target.value })} options={waiters.map((w) => ({ value: w.id, label: w.name }))} /></div>
      <Button type="submit" size="sm">Buscar</Button>
      {Object.values(initial).some(Boolean) && <Button type="button" variant="ghost" size="sm" icon={<X className="w-4 h-4" />} onClick={() => router.push("/pedidos")}>Limpiar</Button>}
    </form>
  );
}
