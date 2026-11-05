"use client";

import { useEffect } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui";

export function AutoPrint({ jobId }: { jobId: string }) {
  useEffect(() => {
    const t = setTimeout(() => {
      window.print();
      fetch(`/api/print/${jobId}/done`, { method: "POST" }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [jobId]);
  return (
    <div className="no-print mb-4 flex gap-2">
      <Button size="sm" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Imprimir</Button>
      <Button size="sm" variant="outline" onClick={() => window.close()}>Cerrar</Button>
    </div>
  );
}
