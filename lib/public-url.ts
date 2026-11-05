import "server-only";
import { headers } from "next/headers";

/**
 * La dirección con la que los clientes llegan al sistema (para los QR). Si el
 * local tiene dominio propio, va en PUBLIC_URL; si no, se usa la dirección con
 * la que se está entrando ahora (la IP del servidor en el wifi del local).
 */
export async function publicUrl(): Promise<string> {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}
