import { route } from "@/lib/api";
import { endSession, getDevice } from "@/lib/auth/session";

/** "Bloquear" en un equipo vinculado vuelve al teclado de PIN; sin equipo, al login. */
export const POST = route(async () => {
  await endSession();
  const device = await getDevice();
  return { ok: true, next: device ? "/pin" : "/login" };
});
