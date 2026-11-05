import "server-only";
import bcrypt from "bcryptjs";
import type { Tx } from "@/lib/db-helpers";
import { slugify } from "@/lib/utils";

export type SetupInput = {
  businessName: string;
  kind: string;
  ownerName: string;
  email: string;
  password: string;
  pin: string;
  tables: number;
};

/**
 * Deja un comercio nuevo listo para trabajar: dueño, medios de pago, cocina y
 * barra, un salón con mesas y categorías base. Después se ajusta todo desde
 * Configuración; la idea es que el primer día ya se pueda abrir una mesa.
 */
export async function createBusiness(tx: Tx, d: SetupInput) {
  const base = slugify(d.businessName) || "comercio";
  let slug = base;
  for (let i = 2; await tx.organization.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;

  const org = await tx.organization.create({ data: { name: d.businessName, slug, kind: d.kind } });
  const owner = await tx.user.create({
    data: {
      organizationId: org.id, name: d.ownerName, role: "OWNER", color: "accent", email: d.email,
      passwordHash: await bcrypt.hash(d.password, 10), pinHash: await bcrypt.hash(d.pin, 10),
    },
  });

  const methods: [string, string, number][] = [["Efectivo", "CASH", 0], ["Débito", "CARD", 0], ["Crédito", "CARD", 0], ["Transferencia", "TRANSFER", 0], ["QR / Billetera", "QR", 0], ["Cuenta corriente", "ACCOUNT", 0]];
  await tx.paymentMethod.createMany({ data: methods.map(([name, kind, adjustPct], sort) => ({ organizationId: org.id, name, kind, adjustPct, sort })) });

  const cocina = await tx.station.create({ data: { organizationId: org.id, name: "Cocina", color: "error", sort: 0 } });
  const barra = await tx.station.create({ data: { organizationId: org.id, name: "Barra", color: "info", sort: 1 } });
  await tx.category.createMany({
    data: [
      { organizationId: org.id, name: "Bebidas", color: "info", stationId: barra.id, sort: 0 },
      { organizationId: org.id, name: "Entradas", color: "turquesa", stationId: cocina.id, sort: 1 },
      { organizationId: org.id, name: "Principales", color: "accent", stationId: cocina.id, sort: 2 },
      { organizationId: org.id, name: "Postres", color: "violet", stationId: cocina.id, sort: 3 },
    ],
  });

  const n = Math.max(0, Math.min(60, d.tables));
  if (n > 0) {
    const cols = Math.min(6, Math.ceil(Math.sqrt(n * 1.6)));
    const rows = Math.ceil(n / cols);
    const area = await tx.area.create({ data: { organizationId: org.id, name: "Salón", sort: 0, width: 1000, height: Math.max(400, rows * 170 + 60) } });
    await tx.diningTable.createMany({
      data: Array.from({ length: n }, (_, i) => ({
        organizationId: org.id, areaId: area.id, name: String(i + 1), shape: "SQUARE", seats: 4,
        x: 50 + (i % cols) * Math.floor(900 / cols), y: 40 + Math.floor(i / cols) * 170, w: 100, h: 100,
      })),
    });
  }
  return { org, owner };
}
