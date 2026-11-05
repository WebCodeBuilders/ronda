import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/** Para Docker, el monitoreo o un balanceador: responde 200 si la base contesta. */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ ok: true, db: "ok", time: new Date().toISOString() });
  } catch {
    return Response.json({ ok: false, db: "sin conexión" }, { status: 503 });
  }
}
