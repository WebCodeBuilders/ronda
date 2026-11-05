"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bike, Check, ChevronRight, Clock, MapPin, MessageCircle, Phone, Plus, ShoppingBag, Store, Monitor } from "lucide-react";
import { Badge, Button, Select } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useLiveRefresh } from "@/lib/realtime/client";
import { api } from "@/lib/client/api";
import { FULFILLMENT_LABEL, ORDER_TYPE_LABEL } from "@/lib/orders/labels";
import { formatCurrency, formatQty, formatTime, cn } from "@/lib/utils";

type O = {
  id: string; number: number; type: string; status: string; fulfillment: string; customerName: string | null; customerPhone: string | null; deliveryAddress: string | null;
  total: number; paid: number; openedAt: string; scheduledFor: string | null; courier: { id: string; name: string } | null; items: { name: string; quantity: number; status: string }[];
};

const COLUMNS: { key: string; label: string; match: (o: O) => boolean }[] = [
  { key: "kitchen", label: "En cocina", match: (o) => o.fulfillment === "PENDING" || o.fulfillment === "PREPARING" },
  { key: "ready", label: "Listos", match: (o) => o.fulfillment === "READY" },
  { key: "road", label: "En camino", match: (o) => o.fulfillment === "ON_THE_WAY" },
  { key: "done", label: "Entregados hoy", match: (o) => o.fulfillment === "DELIVERED" },
];

const TYPE_ICON: Record<string, typeof Bike> = { DELIVERY: Bike, TAKEAWAY: ShoppingBag, COUNTER: Store };

/** El circuito de lo que sale del local, de un vistazo. */
export function DeliveryBoard({ orders, couriers, orgName }: { orders: O[]; couriers: { id: string; name: string }[]; orgName: string }) {
  useLiveRefresh(["order.changed", "kitchen.changed"]);
  const router = useRouter();
  const toast = useToast();
  const [now, setNow] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "DELIVERY" | "TAKEAWAY">("all");
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const shown = orders.filter((o) => filter === "all" || o.type === filter || (filter === "TAKEAWAY" && o.type === "COUNTER"));

  async function step(o: O, s: string, courierId?: string | null) {
    try {
      await api(`/api/orders/${o.id}`, { body: { action: "fulfillment", step: s, courierId } });
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function whatsapp(o: O, text: string) {
    const digits = (o.customerPhone ?? "").replace(/\D/g, "");
    const intl = digits.startsWith("54") ? digits : `549${digits.replace(/^0/, "")}`;
    return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
  }

  return (
    <PageContainer width="full">
      <PageHeader
        title="Delivery y retiro"
        action={
          <>
            <Link href="/pantalla" target="_blank" className="h-10 px-3 rounded-xl border border-border bg-surface text-sm font-semibold text-text-secondary hover:bg-surface-secondary flex items-center gap-1.5"><Monitor className="w-4 h-4" /> Pantalla de retiro</Link>
            <Link href="/mostrador" className="h-10 px-4 rounded-xl bg-accent text-white text-sm font-semibold hover:bg-accent-hover flex items-center gap-1.5"><Plus className="w-4 h-4" /> Nuevo pedido</Link>
          </>
        }
      />
      <div className="flex gap-2 mb-3">
        {([["all", "Todos"], ["DELIVERY", "Delivery"], ["TAKEAWAY", "Para llevar"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("h-9 px-3 rounded-xl border text-sm font-semibold", filter === k ? "bg-accent-light text-accent border-accent" : "border-border text-text-secondary bg-surface")}>{l}</button>
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const list = shown.filter(col.match);
          return (
            <div key={col.key} className="rounded-2xl bg-surface-secondary/60 p-2 min-h-40">
              <p className="px-2 pt-1 pb-2 text-xs font-semibold uppercase tracking-wider text-text-muted flex justify-between">{col.label} <span className="tabular-nums">{list.length}</span></p>
              <div className="space-y-2">
                {list.map((o) => {
                  const Icon = TYPE_ICON[o.type] ?? ShoppingBag;
                  const mins = now ? Math.floor((now - new Date(o.openedAt).getTime()) / 60000) : null;
                  const due = o.total - o.paid > 0.009;
                  return (
                    <div key={o.id} className="rounded-2xl border border-border bg-surface p-3">
                      <Link href={`/pedidos/${o.id}`} className="flex items-start gap-2">
                        <Icon className="w-4 h-4 mt-0.5 text-text-secondary shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-text-primary truncate">#{o.number} · {o.customerName ?? ORDER_TYPE_LABEL[o.type]}</p>
                          <p className="text-xs text-text-muted flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(o.openedAt)}{mins !== null && col.key !== "done" ? ` · hace ${mins} min` : ""}{o.scheduledFor ? ` · para las ${formatTime(o.scheduledFor)}` : ""}</p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-text-muted" />
                      </Link>
                      <p className="text-xs text-text-secondary mt-2 line-clamp-2">{o.items.map((i) => `${formatQty(i.quantity)} ${i.name}`).join(", ") || "Sin productos"}</p>
                      {o.deliveryAddress && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.deliveryAddress)}`} target="_blank" rel="noreferrer" className="mt-1.5 text-xs font-medium text-accent flex items-center gap-1 hover:underline">
                          <MapPin className="w-3 h-3" /> {o.deliveryAddress}
                        </a>
                      )}
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-sm font-semibold tabular-nums">{formatCurrency(o.total)}</span>
                        {due ? <Badge tone="warning">A cobrar</Badge> : <Badge tone="success">Pagado</Badge>}
                      </div>
                      {o.type === "DELIVERY" && col.key !== "done" && (
                        <Select className="mt-2 h-9 py-1.5" value={o.courier?.id ?? ""} placeholder="Repartidor…" onChange={(e) => step(o, o.fulfillment, e.target.value || null)} options={couriers.map((c) => ({ value: c.id, label: c.name }))} />
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {col.key === "kitchen" && <Button size="sm" variant="outline" onClick={() => step(o, "READY")} icon={<Check className="w-4 h-4" />}>Listo</Button>}
                        {col.key === "ready" && o.type === "DELIVERY" && <Button size="sm" onClick={() => step(o, "ON_THE_WAY")} icon={<Bike className="w-4 h-4" />}>Salió</Button>}
                        {(col.key === "road" || (col.key === "ready" && o.type !== "DELIVERY")) && <Button size="sm" onClick={() => step(o, "DELIVERED")} icon={<Check className="w-4 h-4" />}>Entregado</Button>}
                        {o.customerPhone && col.key !== "done" && (
                          <a
                            href={whatsapp(o, col.key === "ready" && o.type !== "DELIVERY" ? `Hola ${o.customerName ?? ""}! Tu pedido #${o.number} de ${orgName} ya está listo para retirar.` : col.key === "road" || col.key === "ready" ? `Hola ${o.customerName ?? ""}! Tu pedido #${o.number} de ${orgName} está en camino.` : `Hola ${o.customerName ?? ""}! Recibimos tu pedido #${o.number} en ${orgName}.`)}
                            target="_blank"
                            rel="noreferrer"
                            className="h-10 lg:h-8 px-3 rounded-xl border border-border text-xs font-semibold text-success-strong flex items-center gap-1 hover:bg-success-subtle"
                          >
                            <MessageCircle className="w-4 h-4" /> Avisar
                          </a>
                        )}
                        {o.customerPhone && <a href={`tel:${o.customerPhone}`} className="h-10 lg:h-8 w-10 lg:w-8 rounded-xl border border-border flex items-center justify-center text-text-secondary hover:bg-surface-secondary" aria-label="Llamar"><Phone className="w-4 h-4" /></a>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </PageContainer>
  );
}
