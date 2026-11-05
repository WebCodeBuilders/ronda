import "server-only";
import net from "node:net";

/**
 * Impresión directa en comanderas térmicas por red (ESC/POS sobre TCP, el
 * estándar de Epson, Hasar, 3nStar, Xprinter y casi todas las chinas).
 *
 * El servidor del local habla con la impresora: no hace falta driver, ni
 * Windows, ni que la compu de la caja tenga la impresora "compartida".
 *
 * El contenido llega como texto con marcas simples, una por renglón:
 *   "@@B texto"  → negrita
 *   "@@L texto"  → doble alto y ancho (número de mesa, título)
 *   "@@C texto"  → centrado
 *   "@@LC texto" → grande y centrado
 *   "@@CUT"      → corte de papel
 *   "@@BEEP"     → pitido (en las que lo soportan)
 */

const ESC = 0x1b;
const GS = 0x1d;

// Página de códigos PC858 (latín con €): cubre todo el castellano.
const CP858: Record<string, number> = {
  "Ç": 0x80, "ü": 0x81, "é": 0x82, "â": 0x83, "ä": 0x84, "à": 0x85, "ç": 0x87, "ê": 0x88, "ë": 0x89, "è": 0x8a,
  "ï": 0x8b, "î": 0x8c, "ì": 0x8d, "Ä": 0x8e, "É": 0x90, "ô": 0x93, "ö": 0x94, "ò": 0x95, "û": 0x96, "ù": 0x97,
  "Ö": 0x99, "Ü": 0x9a, "á": 0xa0, "í": 0xa1, "ó": 0xa2, "ú": 0xa3, "ñ": 0xa4, "Ñ": 0xa5, "ª": 0xa6, "º": 0xa7,
  "¿": 0xa8, "¡": 0xad, "Á": 0xb5, "Â": 0xb6, "À": 0xb7, "Í": 0xd6, "Ó": 0xe0, "Ú": 0xe9, "°": 0xf8, "€": 0xd5,
};

function encodeText(s: string): number[] {
  const out: number[] = [];
  for (const ch of s) {
    const code = ch.charCodeAt(0);
    if (code < 0x80) out.push(code);
    else if (CP858[ch] !== undefined) out.push(CP858[ch]);
    else out.push(0x3f); // "?"
  }
  return out;
}

export function renderEscPos(content: string, copies = 1): Buffer {
  const bytes: number[] = [];
  for (let c = 0; c < Math.max(1, copies); c++) {
    bytes.push(ESC, 0x40); // init
    bytes.push(ESC, 0x74, 19); // codepage PC858
    for (const raw of content.split("\n")) {
      if (raw === "@@CUT") {
        bytes.push(0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00);
        continue;
      }
      if (raw === "@@BEEP") {
        bytes.push(ESC, 0x42, 2, 2);
        continue;
      }
      let line = raw;
      let bold = false, large = false, center = false;
      const m = /^@@([BLC]+) ?/.exec(line);
      if (m) {
        bold = m[1].includes("B");
        large = m[1].includes("L");
        center = m[1].includes("C");
        line = line.slice(m[0].length);
      }
      bytes.push(ESC, 0x61, center ? 1 : 0);
      bytes.push(ESC, 0x45, bold || large ? 1 : 0);
      bytes.push(GS, 0x21, large ? 0x11 : 0x00);
      bytes.push(...encodeText(line), 0x0a);
    }
    bytes.push(ESC, 0x61, 0, ESC, 0x45, 0, GS, 0x21, 0);
    if (!content.includes("@@CUT")) bytes.push(0x0a, 0x0a, 0x0a, GS, 0x56, 0x42, 0x00);
  }
  return Buffer.from(bytes);
}

/** Texto plano (para la vista previa y la impresión desde el navegador). */
export function stripMarks(content: string): string {
  return content
    .split("\n")
    .filter((l) => l !== "@@CUT" && l !== "@@BEEP")
    .map((l) => l.replace(/^@@[BLC]+ ?/, ""))
    .join("\n");
}

export function sendToPrinter(host: string, port: number, data: Buffer, timeoutMs = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (err?: Error) => {
      if (done) return;
      done = true;
      socket.destroy();
      if (err) reject(err);
      else resolve();
    };
    socket.setTimeout(timeoutMs);
    socket.on("timeout", () => finish(new Error(`La impresora ${host}:${port} no respondió`)));
    socket.on("error", (e: NodeJS.ErrnoException) => {
      const why =
        e.code === "ECONNREFUSED" ? "rechazó la conexión" :
        e.code === "EHOSTUNREACH" || e.code === "ENETUNREACH" ? "no está en la red" :
        e.code === "ETIMEDOUT" ? "no respondió" : e.message;
      finish(new Error(`Impresora ${host}:${port}: ${why}`));
    });
    socket.connect(port, host, () => {
      socket.write(data, (err) => {
        if (err) return finish(err);
        socket.end(() => finish());
      });
    });
  });
}
