import { fail } from "@/lib/api";

/**
 * Freno simple contra adivinar PIN o contraseña: 8 intentos por minuto por
 * clave. En memoria: alcanza para el servidor del local y para una instancia.
 */
const hits = new Map<string, number[]>();

export function throttle(key: string, max = 8, windowMs = 60_000) {
  const now = Date.now();
  const list = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (list.length >= max) fail(429, "Demasiados intentos. Esperá un minuto.");
  list.push(now);
  hits.set(key, list);
}
