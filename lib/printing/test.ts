import { formatDate } from "@/lib/utils";

/** Página de prueba: confirma que la impresora responde y que imprime bien los acentos. */
export function testPage(title: string, width: number) {
  return [
    "@@LC PRUEBA DE IMPRESIÓN",
    `@@C ${title}`,
    `@@C ${formatDate(new Date())}`,
    "-".repeat(width),
    "Acentos: áéíóú ÁÉÍÓÚ ñÑ ¿¡ °",
    "@@B Negrita",
    "@@L Grande",
    "-".repeat(width),
    "@@C Si leés esto, la comandera anda.",
    "@@CUT",
  ].join("\n");
}
