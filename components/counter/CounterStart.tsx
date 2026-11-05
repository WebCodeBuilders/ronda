"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bike, ChevronRight, ShoppingBag, Store, MapPin, Phone, UserRound, Clock } from "lucide-react";
import { Badge, Button, CurrencyInput, Input } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { useLiveRefresh } from "@/lib/realtime/client";
import { api } from "@/lib/client/api";
import { CustomerPicker, type PickedCustomer } from "@/components/customers/CustomerPicker";
import { FULFILLMENT_LABEL, ORDER_TYPE_LABEL } from "@/lib/orders/labels";
import { formatCurrency, formatTime, cn } from "@/lib/utils";

type Kind = "COUNTER" | "TAKEAWAY" | "DELIVERY";

const KINDS: { kind: Kind; label: string; desc: string; icon: typeof Store }[] = [
  { kind: "COUNTER", label: "Venta rápida", desc: "Cobrás y sale a cocina. Barra, café, kiosco del parador.", icon: Store },
  { kind: "TAKEAWAY", label: "Para llevar", desc: "Con nombre para llamarlo cuando esté listo.", icon: ShoppingBag },
  { kind: "DELIVERY", label: "Delivery", desc: "Con dirección, costo de envío y repartidor.", icon: Bike },
];

export function CounterStart({ recent }: { recent: { id: string; number: number; type: string; customerName: string | null; total: number; paid: number; openedAt: string; fulfillment: string | null; drafts: number }[] }) {
  useLiveRefresh(["order.changed", "kitchen.changed"]);
  const router = useRouter();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("COUNTER");
  const [customer, setCustomer] = useState<PickedCustomer | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fee, setFee] = useState<number | null>(null);
  const [when, setWhen] = useState("");
  const [busy, setBusy] = useState(false);

  function pickCustomer(c: PickedCustomer | null) {
    setCustomer(c);
    if (c) {
      setName(c.name);
      setPhone(c.phone ?? "");
      if (c.address) setAddress(c.address);
    }
  }

  async function start() {
    setBusy(true);
    try {
      let scheduledFor: string | null = null;
      if (when) {
        const [h, m] = when.split(":").map(Number);
        const d = new Date();
        d.setHours(h!, m!, 0, 0);
        if (d.getTime() < Date.now() - 60_000) d.setDate(d.getDate() + 1);
        scheduledFor = d.toISOString();
      }
      const r = await api<{ id: string }>("/api/orders", {
        body: {
          type: kind,
          customerId: customer?.id ?? null,
          customerName: name.trim() || null,
          customerPhone: phone.trim() || null,
          deliveryAddress: kind === "DELIVERY" ? address.trim() || null : null,
          deliveryFee: kind === "DELIVERY" ? fee ?? 0 : undefined,
          scheduledFor,
        },
      });
      router.push(`/pedidos/${r.id}`);
    } catch (e) {
      toast.error((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <PageContainer width="wide">
      <PageHeader title="Mostrador" description="Pedidos que no son de una mesa: venta rápida, para llevar y delivery." />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="rounded-2xl border border-border bg-surface p-4 space-y-4">
          <div className="grid sm:grid-cols-3 gap-2">
            {KINDS.map((k) => (
              <button key={k.kind} onClick={() => setKind(k.kind)} className={cn("text-left rounded-2xl border p-3 transition-colors", kind === k.kind ? "border-accent bg-accent-light" : "border-border hover:bg-surface-secondary")}>
                <k.icon className={cn("w-6 h-6 mb-2", kind === k.kind ? "text-accent" : "text-text-secondary")} />
                <p className={cn("text-sm font-semibold", kind === k.kind ? "text-accent" : "text-text-primary")}>{k.label}</p>
                <p className="text-xs text-text-secondary mt-0.5 leading-snug">{k.desc}</p>
              </button>
            ))}
          </div>
          {kind !== "COUNTER" && (
            <>
              <div>
                <p className="text-sm font-medium mb-1.5">Cliente (buscá por teléfono o nombre)</p>
                <CustomerPicker value={customer} onChange={pickCustomer} />
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Input label="Nombre para llamarlo" icon={<UserRound />} value={name} onChange={(e) => setName(e.target.value)} />
                <Input label="Teléfono" icon={<Phone />} value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
              </div>
              {kind === "DELIVERY" && (
                <div className="grid sm:grid-cols-[minmax(0,1fr)_12rem] gap-3">
                  <Input label="Dirección de entrega" icon={<MapPin />} value={address} onChange={(e) => setAddress(e.target.value)} />
                  <div>
                    <p className="text-sm font-medium mb-1.5">Envío</p>
                    <CurrencyInput value={fee} onChange={setFee} />
                  </div>
                </div>
              )}
              <div className="max-w-[12rem]">
                <Input label="Para las (opcional)" icon={<Clock />} type="time" value={when} onChange={(e) => setWhen(e.target.value)} />
              </div>
            </>
          )}
          <Button size="lg" fullWidth loading={busy} onClick={start} disabled={kind === "DELIVERY" && !address.trim()}>
            Empezar {KINDS.find((k) => k.kind === kind)!.label.toLowerCase()}
          </Button>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-2">En curso</h2>
          <div className="rounded-2xl border border-border bg-surface divide-y divide-border">
            {recent.length === 0 && <p className="px-4 py-6 text-sm text-text-secondary text-center">No hay pedidos de mostrador abiertos.</p>}
            {recent.map((o) => (
              <Link key={o.id} href={`/pedidos/${o.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-secondary">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-text-primary truncate">#{o.number} · {o.customerName ?? ORDER_TYPE_LABEL[o.type]}</p>
                  <p className="text-xs text-text-muted">{ORDER_TYPE_LABEL[o.type]} · {formatTime(o.openedAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">{formatCurrency(o.total)}</p>
                  {o.drafts > 0 ? <Badge tone="warning">Sin marchar</Badge> : o.fulfillment ? <Badge tone="info">{FULFILLMENT_LABEL[o.fulfillment]}</Badge> : null}
                </div>
                <ChevronRight className="w-4 h-4 text-text-muted" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
