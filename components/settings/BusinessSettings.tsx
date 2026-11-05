"use client";

import { useState } from "react";
import { Printer, Save } from "lucide-react";
import { Button, CurrencyInput, Input, Select } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { Toggle } from "@/components/menu/ProductForm";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/client/api";

type S = {
  name: string; kind: string; address: string; phone: string; taxId: string; serviceChargePerGuest: number; suggestedTipPct: number; kitchenLateMinutes: number;
  voidNeedsManager: boolean; qrOrderingEnabled: boolean; qrOrderNeedsApproval: boolean; pesosPerPoint: number; ticketFooter: string;
  receiptPrinterHost: string; receiptPrinterPort: number; receiptPrinterWidth: number;
};

export const KINDS = [
  { value: "restaurant", label: "Restaurante" }, { value: "parador", label: "Parador / balneario" }, { value: "bar", label: "Bar / cervecería" },
  { value: "cafeteria", label: "Cafetería" }, { value: "pizzeria", label: "Pizzería" }, { value: "hamburgueseria", label: "Hamburguesería" },
  { value: "parrilla", label: "Parrilla" }, { value: "heladeria", label: "Heladería" }, { value: "foodtruck", label: "Food truck / patio" }, { value: "rotiseria", label: "Rotisería / delivery" },
];

export function BusinessSettings({ initial }: { initial: S }) {
  const toast = useToast();
  const [s, setS] = useState(initial);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof S>(k: K, v: S[K]) => setS((x) => ({ ...x, [k]: v }));

  async function save() {
    setBusy(true);
    try {
      await api("/api/settings", { method: "PATCH", body: { ...s, address: s.address || null, phone: s.phone || null, taxId: s.taxId || null, ticketFooter: s.ticketFooter || null, receiptPrinterHost: s.receiptPrinterHost || null } });
      toast.success("Guardado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    try {
      const r = await api<{ browserPrint?: boolean; jobId?: string }>("/api/print/test-receipt", { body: {} });
      if (r.browserPrint) window.open(`/imprimir/${r.jobId}`, "_blank", "width=420,height=600");
      else toast.success("Salió la prueba por la impresora");
    } catch (e) {
      toast.error("La impresora no respondió", (e as Error).message);
    }
  }

  return (
    <PageContainer width="default">
      <PageHeader title="Negocio" back={{ href: "/configuracion", label: "Configuración" }} />
      <div className="space-y-3 lg:space-y-4 pb-24">
        <Card title="Datos">
          <div className="grid sm:grid-cols-2 gap-3">
            <Input label="Nombre" value={s.name} onChange={(e) => set("name", e.target.value)} />
            <Select label="Rubro" value={s.kind} onChange={(e) => set("kind", e.target.value)} options={KINDS} />
            <Input label="Dirección" value={s.address} onChange={(e) => set("address", e.target.value)} />
            <Input label="Teléfono" value={s.phone} onChange={(e) => set("phone", e.target.value)} />
            <Input label="CUIT" value={s.taxId} onChange={(e) => set("taxId", e.target.value)} />
            <Input label="Pie del ticket" value={s.ticketFooter} onChange={(e) => set("ticketFooter", e.target.value)} />
          </div>
        </Card>
        <Card title="Cuenta">
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <p className="text-sm font-medium mb-1.5">Cubierto por persona</p>
              <CurrencyInput value={s.serviceChargePerGuest} onChange={(v) => set("serviceChargePerGuest", v ?? 0)} />
              <p className="text-xs text-text-muted mt-1">0 = no se cobra.</p>
            </div>
            <Input label="Propina sugerida (%)" type="number" min={0} max={50} value={s.suggestedTipPct} onChange={(e) => set("suggestedTipPct", Number(e.target.value) || 0)} hint="Sale en la precuenta." />
            <div>
              <p className="text-sm font-medium mb-1.5">Un punto cada</p>
              <CurrencyInput value={s.pesosPerPoint} onChange={(v) => set("pesosPerPoint", v ?? 0)} />
              <p className="text-xs text-text-muted mt-1">Puntos de fidelidad. 0 = desactivado.</p>
            </div>
          </div>
        </Card>
        <Card title="Control">
          <Input label="Una comanda está demorada a los (minutos)" type="number" min={1} value={s.kitchenLateMinutes} onChange={(e) => set("kitchenLateMinutes", Number(e.target.value) || 15)} className="max-w-[10rem]" />
          <Toggle label="Anular lo marchado pide PIN de encargado" hint="Un mozo no puede anular un plato que ya está en cocina sin autorización." checked={s.voidNeedsManager} onChange={(v) => set("voidNeedsManager", v)} />
        </Card>
        <Card title="Carta QR en las mesas">
          <Toggle label="Los clientes pueden pedir desde el QR" hint="Si está apagado, el QR muestra la carta, llama al mozo y pide la cuenta." checked={s.qrOrderingEnabled} onChange={(v) => set("qrOrderingEnabled", v)} />
          <Toggle label="Lo que piden por QR lo aprueba un mozo" hint="Recomendado: el mozo confirma antes de que vaya a cocina." checked={s.qrOrderNeedsApproval} onChange={(v) => set("qrOrderNeedsApproval", v)} />
        </Card>
        <Card title="Impresora de la caja">
          <p className="text-sm text-text-secondary">Precuentas, recibos y cierres de caja. Si no cargás una IP, se imprime desde el navegador (cualquier impresora conectada a la compu).</p>
          <div className="grid sm:grid-cols-3 gap-3">
            <Input label="IP de la impresora" placeholder="192.168.0.50" value={s.receiptPrinterHost} onChange={(e) => set("receiptPrinterHost", e.target.value)} />
            <Input label="Puerto" type="number" value={s.receiptPrinterPort} onChange={(e) => set("receiptPrinterPort", Number(e.target.value) || 9100)} />
            <Select label="Papel" value={String(s.receiptPrinterWidth)} onChange={(e) => set("receiptPrinterWidth", Number(e.target.value))} options={[{ value: "42", label: "80 mm (42 caracteres)" }, { value: "48", label: "80 mm (48 caracteres)" }, { value: "32", label: "58 mm (32 caracteres)" }]} />
          </div>
          <Button variant="outline" size="sm" icon={<Printer className="w-4 h-4" />} onClick={test}>Imprimir prueba</Button>
        </Card>
      </div>
      <div className="fixed bottom-[var(--tabbar-total)] lg:bottom-0 inset-x-0 lg:left-60 z-30 border-t border-border bg-surface/95 backdrop-blur px-4 py-3">
        <div className="max-w-4xl mx-auto flex justify-end"><Button loading={busy} onClick={save} icon={<Save className="w-4 h-4" />}>Guardar</Button></div>
      </div>
    </PageContainer>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 space-y-4">
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {children}
    </div>
  );
}
