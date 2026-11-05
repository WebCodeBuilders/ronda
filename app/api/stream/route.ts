import { getCurrentUser, getDevice } from "@/lib/auth/session";
import { ensureListening, subscribe } from "@/lib/realtime/bus";

export const dynamic = "force-dynamic";

/**
 * Canal de tiempo real (Server-Sent Events). Lo abre cada terminal: caja,
 * mozos, cocina, pantalla de retiro. El navegador reconecta solo si se corta.
 */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  const device = user ? null : await getDevice();
  const orgId = user?.organizationId ?? device?.organizationId;
  if (!orgId) return new Response("Sin sesión", { status: 401 });

  await ensureListening();
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };
      send({ type: "hello" });
      const unsub = subscribe(orgId, send);
      // Latido: mantiene viva la conexión a través de proxies y detecta cortes.
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 20_000);
      cleanup = () => {
        clearInterval(ping);
        unsub();
      };
      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          /* ya cerrado */
        }
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
