"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { ErrorPanel } from "@/components/shared/ErrorPanel";

/** Cualquier error de una pantalla: se explica, se puede reintentar y volver. */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="min-h-[60dvh] flex items-center justify-center px-4">
      <ErrorPanel
        icon={AlertCircle}
        title="No se pudo cargar esta pantalla"
        description="Puede ser un corte de conexión con el servidor del local. Probá de nuevo; si sigue pasando, avisale a quien administra el sistema con el código de abajo."
        digest={error.digest}
        onRetry={reset}
        backHref="/"
        backLabel="Inicio"
      />
    </div>
  );
}
