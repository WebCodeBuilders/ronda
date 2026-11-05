import { NextResponse, type NextRequest } from "next/server";

/**
 * Primer filtro, barato: sin ninguna cookie no se entra a la app. La
 * validación real (firma, vencimiento, permisos) la hace cada pantalla y cada
 * API en el servidor.
 *
 * Un equipo vinculado sin persona logueada va al teclado de PIN; las
 * pantallas de cocina y de retiro funcionan solo con el equipo.
 */
const PUBLIC = ["/login", "/pin", "/vincular", "/m/", "/imprimir/", "/setup"];
const DEVICE_ONLY = ["/cocina", "/pantalla"];

export default function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const hasSession = req.cookies.has("ronda_session");
  const hasDevice = req.cookies.has("ronda_device");
  if (hasSession) return NextResponse.next();
  if (hasDevice && DEVICE_ONLY.some((p) => pathname.startsWith(p))) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = hasDevice ? "/pin" : "/login";
  url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
