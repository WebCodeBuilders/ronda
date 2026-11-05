import "server-only";
import { EventEmitter } from "node:events";
import { Client } from "pg";
import type { RealtimeEvent } from "./events";

/**
 * Tiempo real entre todas las terminales del local.
 *
 * Cada cambio se publica con `pg_notify` en Postgres y cada proceso del
 * servidor lo escucha con `LISTEN`. Así funciona igual con un solo servidor en
 * la compu de la caja que con varios en la nube, y no hay un broker extra que
 * instalar ni que se caiga. Las pantallas lo reciben por SSE (`/api/stream`).
 *
 * Si la conexión de escucha se corta, se reconecta sola y avisa a las
 * pantallas con un evento `resync` para que vuelvan a pedir todo: ninguna
 * terminal se queda mostrando una mesa vieja.
 */

const CHANNEL = "ronda_events";

type Bus = { emitter: EventEmitter; client: Client | null; connecting: Promise<void> | null };

const g = globalThis as unknown as { __rondaBus?: Bus };

function bus(): Bus {
  if (!g.__rondaBus) {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    g.__rondaBus = { emitter, client: null, connecting: null };
  }
  return g.__rondaBus;
}

async function connect(): Promise<void> {
  const b = bus();
  if (b.client) return;
  if (b.connecting) return b.connecting;
  b.connecting = (async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    client.on("notification", (msg) => {
      if (msg.channel !== CHANNEL || !msg.payload) return;
      try {
        const ev = JSON.parse(msg.payload) as RealtimeEvent & { orgId: string };
        b.emitter.emit(ev.orgId, ev);
      } catch {
        /* payload ajeno: se ignora */
      }
    });
    const retry = () => {
      b.client = null;
      b.connecting = null;
      // Las pantallas de todas las organizaciones vuelven a pedir el estado.
      b.emitter.emit("*resync");
      setTimeout(() => connect().catch(() => {}), 2000);
    };
    client.on("error", retry);
    client.on("end", retry);
    await client.connect();
    await client.query(`LISTEN ${CHANNEL}`);
    b.client = client;
    b.connecting = null;
  })();
  try {
    await b.connecting;
  } catch (e) {
    b.connecting = null;
    throw e;
  }
}

export async function ensureListening() {
  await connect();
}

/**
 * Publica un evento para todas las terminales del comercio. Llamar DESPUÉS de
 * que la transacción haya confirmado: si no, una pantalla podría refrescar y
 * todavía no ver el cambio.
 */
export async function publish(orgId: string, event: RealtimeEvent): Promise<void> {
  const { prisma } = await import("@/lib/prisma");
  const payload = JSON.stringify({ ...event, orgId, at: Date.now() });
  try {
    await prisma.$executeRaw`SELECT pg_notify(${CHANNEL}, ${payload})`;
  } catch (e) {
    // Sin tiempo real el sistema sigue funcionando (las pantallas refrescan solas cada tanto).
    console.error("[realtime] no se pudo publicar", e);
  }
}

export function subscribe(orgId: string, fn: (ev: RealtimeEvent) => void): () => void {
  const b = bus();
  const resync = () => fn({ type: "resync" });
  b.emitter.on(orgId, fn);
  b.emitter.on("*resync", resync);
  return () => {
    b.emitter.off(orgId, fn);
    b.emitter.off("*resync", resync);
  };
}
