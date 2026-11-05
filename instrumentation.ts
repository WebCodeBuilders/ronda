/**
 * Arranque del servidor: deja escuchando el tiempo real y el reintento de
 * impresiones apenas levanta, sin esperar a que alguien abra una pantalla.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.DATABASE_URL) return;
  try {
    const { ensureListening } = await import("@/lib/realtime/bus");
    const { startPrintRetryLoop } = await import("@/lib/printing/queue");
    await ensureListening();
    startPrintRetryLoop();
  } catch (e) {
    console.error("[ronda] no se pudo iniciar el tiempo real o la cola de impresión", e);
  }
}
