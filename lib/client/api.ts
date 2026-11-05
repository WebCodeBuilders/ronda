"use client";

/**
 * fetch con el idioma de la app: devuelve el JSON o tira un Error con el
 * mensaje que armó el servidor (que ya está en castellano y es para la persona).
 */
export class ClientApiError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
  }
}

export async function api<T = { ok: true }>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers: opts.body === undefined ? undefined : { "Content-Type": "application/json" },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ClientApiError("Sin conexión con el servidor del local. Revisá el wifi.", 0, "OFFLINE");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && data.code === "NO_SESSION" && typeof window !== "undefined") {
      window.location.href = "/pin";
    }
    throw new ClientApiError(data.error ?? "Algo salió mal.", res.status, data.code);
  }
  return data as T;
}
