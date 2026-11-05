"use client";

/** Último recurso: si falla el diseño entero, igual hay una salida. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es">
      <body style={{ fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, background: "#F5F7FA", color: "#1D3347" }}>
        <div style={{ textAlign: "center", padding: 16 }}>
          <h1 style={{ fontSize: 20 }}>ronda no pudo arrancar esta pantalla</h1>
          <p style={{ color: "#4F6679" }}>Probá de nuevo. Si sigue, reiniciá el servidor del local.</p>
          <button onClick={reset} style={{ marginTop: 12, padding: "10px 20px", borderRadius: 16, border: 0, background: "#0A3D62", color: "#fff", fontWeight: 600 }}>Reintentar</button>
        </div>
      </body>
    </html>
  );
}
