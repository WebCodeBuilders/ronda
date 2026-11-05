/** A dónde va cada equipo o persona al entrar: cada uno a su pantalla de trabajo. */
export function homeFor(opts: { deviceKind?: string | null; role?: string | null }): string {
  switch (opts.deviceKind) {
    case "KDS":
      return "/cocina";
    case "DISPLAY":
      return "/pantalla";
    case "WAITER":
      return "/salon";
  }
  switch (opts.role) {
    case "WAITER":
      return "/salon";
    case "KITCHEN":
      return "/cocina";
    case "DELIVERY":
      return "/delivery";
    default:
      return "/";
  }
}

/** Solo rutas internas: un `next` con dominio ajeno se ignora. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}
