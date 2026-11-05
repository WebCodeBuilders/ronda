import "server-only";
import { redirect } from "next/navigation";
import { getCurrentUser, getDevice, type CurrentUser } from "./session";
import type { Permission } from "@/lib/permissions";
import { homeFor } from "./home";

/**
 * Para las pantallas: sin sesión → al PIN (equipo vinculado) o al login; sin
 * permiso → a su pantalla de inicio. No hay pantalla de "acceso denegado".
 */
export async function pageUser(...anyOf: Permission[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const device = await getDevice();
    redirect(device ? "/pin" : "/login");
  }
  if (anyOf.length && !anyOf.some((p) => user.permissions.has(p))) {
    const home = homeFor({ role: user.role });
    redirect(home === "/" ? (user.permissions.has("salon.view") ? "/salon" : "/login") : home);
  }
  return user;
}
