"use client";

import { Printer, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";
import { LogoMark } from "@/components/brand/Logo";

/** Hoja para imprimir y pegar en cada mesa. */
export function QrSheet({ orgName, base, items }: { orgName: string; base: string; items: { id: string; name: string; area: string; url: string; svg: string }[] }) {
  return (
    <PageContainer width="wide">
      <div className="no-print">
        <PageHeader title="QR de las mesas" back={{ href: "/configuracion", label: "Configuración" }} action={<Button size="sm" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Imprimir</Button>} />
        <p className="text-sm text-text-secondary mb-4">
          Los QR apuntan a <b>{base}</b>. Para que funcionen desde el celular del cliente, esa dirección tiene que ser accesible: un dominio público (variable PUBLIC_URL) o el wifi del local para clientes.
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 print:grid-cols-3">
        {items.map((i) => (
          <div key={i.id} className="rounded-2xl border border-border bg-surface p-4 text-center break-inside-avoid">
            <div className="flex items-center justify-center gap-1.5 text-accent mb-2"><LogoMark className="w-5 h-5" /><span className="text-sm font-bold">{orgName}</span></div>
            <div className="mx-auto w-40 h-40 [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: i.svg }} />
            <p className="text-2xl font-bold text-text-primary mt-2">Mesa {i.name}</p>
            <p className="text-xs text-text-secondary">Escaneá para ver la carta, pedir y llamar al mozo</p>
            <a href={i.url} target="_blank" rel="noreferrer" className="no-print mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"><ExternalLink className="w-3 h-3" /> Probar</a>
          </div>
        ))}
      </div>
    </PageContainer>
  );
}
