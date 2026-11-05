import "server-only";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { permissionsFor, type Permission } from "@/lib/permissions";

/**
 * Sesiones de ronda.
 *
 * Dos cookies, dos preguntas distintas:
 *  - `ronda_device`: ¿qué equipo es este? (la tablet del mozo, la pantalla de
 *    cocina, la caja). Se vincula una vez con un código y dura un año.
 *  - `ronda_session`: ¿quién está usando el equipo? Se abre con email y
 *    contraseña o, en un equipo vinculado, con el PIN del empleado. Corta a
 *    las 12 h y cuando el usuario cambia su PIN/contraseña (`sessionsValidFrom`).
 *
 * La sesión es un JSON firmado con HMAC: no hace falta tabla de sesiones y el
 * servidor del local sigue andando aunque no haya internet.
 */

export const SESSION_COOKIE = "ronda_session";
export const DEVICE_COOKIE = "ronda_device";
const SESSION_HOURS = 12;

type SessionPayload = { uid: string; oid: string; did?: string; iat: number; exp: number };

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("Falta SESSION_SECRET (mínimo 16 caracteres) en el .env");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function encodeSession(p: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(p)).toString("base64url");
  return `${data}.${sign(data)}`;
}

export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString()) as SessionPayload;
    if (p.exp < Date.now()) return null;
    return p;
  } catch {
    return null;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function startSession(userId: string, organizationId: string, deviceId?: string) {
  const now = Date.now();
  const token = encodeSession({ uid: userId, oid: organizationId, did: deviceId, iat: now, exp: now + SESSION_HOURS * 3600_000 });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
    secure: process.env.COOKIE_SECURE === "true",
  });
}

export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function setDeviceCookie(token: string) {
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 3600,
    secure: process.env.COOKIE_SECURE === "true",
  });
}

export type CurrentDevice = {
  id: string;
  name: string;
  kind: string;
  stationId: string | null;
  organizationId: string;
};

export async function getDevice(): Promise<CurrentDevice | null> {
  const token = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!token) return null;
  const device = await prisma.device.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, name: true, kind: true, stationId: true, organizationId: true, active: true, lastSeenAt: true },
  });
  if (!device || !device.active) return null;
  // "Visto por última vez" con un minuto de tolerancia, para no escribir en cada request.
  if (!device.lastSeenAt || Date.now() - device.lastSeenAt.getTime() > 60_000) {
    await prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return { id: device.id, name: device.name, kind: device.kind, stationId: device.stationId, organizationId: device.organizationId };
}

export type CurrentUser = {
  id: string;
  name: string;
  role: string;
  color: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  deviceId: string | null;
  permissions: Set<Permission>;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const p = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!p) return null;
  const user = await prisma.user.findUnique({
    where: { id: p.uid },
    select: {
      id: true, name: true, role: true, color: true, active: true, organizationId: true, sessionsValidFrom: true,
      organization: { select: { name: true, slug: true } },
    },
  });
  if (!user || !user.active || user.organizationId !== p.oid) return null;
  if (user.sessionsValidFrom.getTime() > p.iat) return null;
  return {
    id: user.id,
    name: user.name,
    role: user.role,
    color: user.color,
    organizationId: user.organizationId,
    organizationName: user.organization.name,
    organizationSlug: user.organization.slug,
    deviceId: p.did ?? null,
    permissions: permissionsFor(user.role),
  };
}
