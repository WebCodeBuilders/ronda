import "server-only";
import { z, ZodError } from "zod";
import { getCurrentUser, getDevice, type CurrentUser, type CurrentDevice } from "@/lib/auth/session";
import type { Permission } from "@/lib/permissions";

/**
 * Error con mensaje para la persona. Lo que se tira con `ApiError` llega tal
 * cual a la pantalla; cualquier otro error se registra y se muestra genérico.
 */
export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
  }
}

export function fail(status: number, message: string, code?: string): never {
  throw new ApiError(status, message, code);
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response | unknown>;

/** Envuelve un handler: errores a JSON, éxito a JSON. */
export function route<C>(handler: Handler<C>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      const out = await handler(req, ctx);
      if (out instanceof Response) return out;
      return Response.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) return Response.json({ error: e.message, code: e.code }, { status: e.status });
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return Response.json({ error: first ? `${first.path.join(".") || "dato"}: ${first.message}` : "Datos inválidos" }, { status: 400 });
      }
      console.error("[api]", e);
      return Response.json({ error: "Algo salió mal. Probá de nuevo." }, { status: 500 });
    }
  };
}

export async function requireUser(...perms: Permission[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) fail(401, "Tu sesión terminó. Volvé a entrar.", "NO_SESSION");
  for (const p of perms) {
    if (!user.permissions.has(p)) fail(403, "No tenés permiso para esto.", "FORBIDDEN");
  }
  return user;
}

/**
 * Para pantallas que también puede usar un equipo sin persona logueada (la
 * pantalla de cocina, la de retiro): alcanza con un usuario con el permiso o
 * con un equipo vinculado del tipo indicado.
 */
export async function requireUserOrDevice(perm: Permission, deviceKinds: string[]): Promise<{ organizationId: string; user: CurrentUser | null; device: CurrentDevice | null }> {
  const user = await getCurrentUser();
  if (user && user.permissions.has(perm)) return { organizationId: user.organizationId, user, device: null };
  const device = await getDevice();
  if (device && deviceKinds.includes(device.kind)) return { organizationId: device.organizationId, user: null, device };
  if (user) fail(403, "No tenés permiso para esto.", "FORBIDDEN");
  fail(401, "Tu sesión terminó. Volvé a entrar.", "NO_SESSION");
}

export async function body<T extends z.ZodType>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    fail(400, "El pedido llegó vacío o mal armado.");
  }
  return schema.parse(raw);
}
