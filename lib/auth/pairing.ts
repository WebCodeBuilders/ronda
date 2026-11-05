import "server-only";
import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** Código de 6 números, único, que vence a los 30 minutos. */
export async function newPairingCode(): Promise<string> {
  for (let i = 0; i < 20; i++) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const taken = await prisma.device.findUnique({ where: { pairingCode: code } });
    if (!taken) return code;
  }
  throw new Error("No se pudo generar un código");
}
