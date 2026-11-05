/**
 * Datos de demostración: un parador de playa con salón, terraza y sombrillas.
 * Deja todo listo para probar el circuito completo: equipos vinculables, mozos
 * con PIN, carta con modificadores y recetas, dos semanas de ventas para los
 * reportes y algunas mesas abiertas en distintos estados.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const DAY = 86_400_000;
let seed = 42;
function rnd() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!;
}
function r2(n: number) {
  return Math.round(n * 100) / 100;
}

async function main() {
  const existing = await prisma.organization.findUnique({ where: { slug: "parador-la-ronda" } });
  if (existing) {
    console.log("Borrando la demo anterior…");
    await prisma.organization.delete({ where: { id: existing.id } });
  }

  const org = await prisma.organization.create({
    data: {
      name: "Parador La Ronda",
      slug: "parador-la-ronda",
      kind: "parador",
      address: "Av. Costanera 1200, Mar de las Pampas",
      phone: "2255 40-1234",
      taxId: "30-71234567-8",
      serviceChargePerGuest: 1500,
      suggestedTipPct: 10,
      kitchenLateMinutes: 15,
      ticketFooter: "Gracias por venir. ¡Te esperamos en la próxima ronda!",
    },
  });
  const orgId = org.id;

  // ── Equipo ──
  const pw = await bcrypt.hash("ronda1234", 10);
  const pin = (p: string) => bcrypt.hash(p, 10);
  const mkUser = async (name: string, role: string, p: string, color: string, email?: string) =>
    prisma.user.create({ data: { organizationId: orgId, name, role, color, pinHash: await pin(p), email, passwordHash: email ? pw : null } });
  const owner = await mkUser("Sofía Duarte", "OWNER", "1111", "accent", "duenio@ronda.app");
  const manager = await mkUser("Diego Paz", "MANAGER", "2222", "violet", "encargado@ronda.app");
  const cashier = await mkUser("Carla Ruiz", "CASHIER", "3333", "turquesa");
  const lucia = await mkUser("Lucía Gómez", "WAITER", "4444", "success");
  const martin = await mkUser("Martín Sosa", "WAITER", "5555", "warning");
  const nico = await mkUser("Nicolás Vera", "WAITER", "8888", "info");
  await mkUser("Cocina", "KITCHEN", "6666", "error");
  const courier = await mkUser("Joaquín (moto)", "DELIVERY", "7777", "neutral");
  const waiters = [lucia, martin, nico];

  // ── Estaciones ──
  const cocina = await prisma.station.create({ data: { organizationId: orgId, name: "Cocina", color: "error", sort: 0 } });
  const parrilla = await prisma.station.create({ data: { organizationId: orgId, name: "Parrilla", color: "warning", sort: 1 } });
  const barra = await prisma.station.create({ data: { organizationId: orgId, name: "Barra", color: "info", sort: 2 } });

  // ── Equipos (códigos de vinculación de la demo, vencen en 30 días) ──
  const exp = new Date(Date.now() + 30 * DAY);
  await prisma.device.createMany({
    data: [
      { organizationId: orgId, name: "Caja principal", kind: "POS", pairingCode: "111111", pairingExpires: exp },
      { organizationId: orgId, name: "Tablet mozo 1", kind: "WAITER", pairingCode: "222222", pairingExpires: exp },
      { organizationId: orgId, name: "Pantalla cocina", kind: "KDS", stationId: cocina.id, pairingCode: "333333", pairingExpires: exp },
      { organizationId: orgId, name: "Pantalla barra", kind: "KDS", stationId: barra.id, pairingCode: "444444", pairingExpires: exp },
      { organizationId: orgId, name: "Pantalla de retiro", kind: "DISPLAY", pairingCode: "555555", pairingExpires: exp },
    ],
  });

  // ── Salón ──
  const salon = await prisma.area.create({ data: { organizationId: orgId, name: "Salón", sort: 0 } });
  const terraza = await prisma.area.create({ data: { organizationId: orgId, name: "Terraza", sort: 1 } });
  const playa = await prisma.area.create({ data: { organizationId: orgId, name: "Playa", sort: 2, height: 560 } });
  const tables: { id: string; name: string; areaId: string }[] = [];
  const mkTable = async (areaId: string, name: string, shape: string, x: number, y: number, seats: number, w = 90, h = 90) => {
    const t = await prisma.diningTable.create({ data: { organizationId: orgId, areaId, name, shape, x, y, w, h, seats } });
    tables.push(t);
    return t;
  };
  for (let i = 0; i < 12; i++) {
    const col = i % 4, row = Math.floor(i / 4);
    const round = i % 3 === 1;
    await mkTable(salon.id, String(i + 1), round ? "ROUND" : i % 4 === 3 ? "RECT" : "SQUARE", 60 + col * 220, 60 + row * 190, i % 4 === 3 ? 6 : 4, i % 4 === 3 ? 150 : 100, 100);
  }
  for (let i = 0; i < 6; i++) await mkTable(salon.id, `B${i + 1}`, "BAR", 80 + i * 120, 560, 1, 60, 60);
  for (let i = 0; i < 8; i++) await mkTable(terraza.id, String(20 + i + 1), i % 2 ? "ROUND" : "SQUARE", 70 + (i % 4) * 220, 80 + Math.floor(i / 4) * 230, 4, 100, 100);
  for (let i = 0; i < 10; i++) await mkTable(playa.id, `S${i + 1}`, "UMBRELLA", 60 + (i % 5) * 185, 60 + Math.floor(i / 5) * 230, 4, 110, 110);
  for (let i = 0; i < 5; i++) await mkTable(playa.id, `R${i + 1}`, "LOUNGER", 80 + i * 185, 460, 2, 120, 60);

  // ── Medios de pago ──
  const pm = async (name: string, kind: string, sort: number, adjustPct = 0) =>
    prisma.paymentMethod.create({ data: { organizationId: orgId, name, kind, sort, adjustPct } });
  const efectivo = await pm("Efectivo", "CASH", 0);
  const debito = await pm("Débito", "CARD", 1);
  const credito = await pm("Crédito", "CARD", 2, 10);
  const transfer = await pm("Transferencia", "TRANSFER", 3);
  const qr = await pm("QR Mercado Pago", "QR", 4);
  await pm("Cuenta corriente", "ACCOUNT", 5);
  const methods = [efectivo, efectivo, efectivo, debito, debito, credito, transfer, qr, qr];

  // ── Modificadores ──
  const mg = async (name: string, minSelect: number, maxSelect: number, options: [string, number][]) =>
    prisma.modifierGroup.create({
      data: { organizationId: orgId, name, minSelect, maxSelect, options: { create: options.map(([n, d], i) => ({ name: n, priceDelta: d, sort: i })) } },
    });
  const punto = await mg("Punto de la carne", 1, 1, [["Jugoso", 0], ["A punto", 0], ["Cocido", 0]]);
  const guarni = await mg("Guarnición", 1, 1, [["Papas fritas", 0], ["Puré", 0], ["Ensalada mixta", 0], ["Papas rústicas", 1500]]);
  const extras = await mg("Extras", 0, 4, [["Huevo frito", 1200], ["Cheddar", 1500], ["Panceta", 1800], ["Jamón y queso", 2000]]);
  const sin = await mg("Sin…", 0, 5, [["Sin sal", 0], ["Sin cebolla", 0], ["Sin tomate", 0], ["Sin TACC (consultar)", 0]]);
  const hielo = await mg("Hielo y limón", 0, 2, [["Sin hielo", 0], ["Con limón", 0]]);
  const leche = await mg("Leche", 0, 1, [["Leche descremada", 0], ["Leche vegetal", 900]]);

  // ── Carta ──
  type P = { name: string; price: number; cost: number; short?: string; desc?: string; mods?: string[]; course?: number; skip?: boolean; prep?: number; tags?: string[]; open?: boolean };
  const groups: Record<string, string> = { punto: punto.id, guarni: guarni.id, extras: extras.id, sin: sin.id, hielo: hielo.id, leche: leche.id };
  const products: Record<string, { id: string; price: number; categoryCourse: number }> = {};
  const cat = async (name: string, color: string, stationId: string, course: number, items: P[]) => {
    const c = await prisma.category.create({ data: { organizationId: orgId, name, color, stationId, sort: Object.keys(products).length } });
    for (const [i, p] of items.entries()) {
      const prod = await prisma.product.create({
        data: {
          organizationId: orgId, categoryId: c.id, name: p.name, shortName: p.short, description: p.desc, price: p.price, cost: p.cost,
          course: p.course ?? course, skipKitchen: p.skip ?? false, prepMinutes: p.prep ?? 10, tags: p.tags ?? [], sort: i, openPrice: p.open ?? false,
          modifierGroups: { create: (p.mods ?? []).map((g, s) => ({ groupId: groups[g]!, sort: s })) },
        },
      });
      products[p.name] = { id: prod.id, price: p.price, categoryCourse: p.course ?? course };
    }
  };
  await cat("Bebidas", "info", barra.id, 0, [
    { name: "Agua mineral 500 ml", short: "Agua", price: 2500, cost: 700, skip: true, mods: ["hielo"] },
    { name: "Agua con gas 500 ml", short: "Agua c/gas", price: 2500, cost: 700, skip: true, mods: ["hielo"] },
    { name: "Gaseosa línea Coca 500 ml", short: "Gaseosa", price: 3200, cost: 1100, skip: true, mods: ["hielo"] },
    { name: "Limonada con menta y jengibre", short: "Limonada", price: 4800, cost: 900, prep: 4, tags: ["vegano"] },
    { name: "Jugo de naranja exprimido", short: "Jugo naranja", price: 4500, cost: 1200, prep: 4, tags: ["vegano"] },
  ]);
  await cat("Cervezas y tragos", "warning", barra.id, 0, [
    { name: "Pinta rubia tirada", short: "Pinta rubia", price: 5200, cost: 1300, prep: 2 },
    { name: "Pinta IPA tirada", short: "Pinta IPA", price: 5800, cost: 1500, prep: 2 },
    { name: "Fernet con coca", short: "Fernet", price: 6500, cost: 1900, prep: 3, mods: ["hielo"] },
    { name: "Aperol spritz", short: "Aperol", price: 7500, cost: 2300, prep: 4 },
    { name: "Gin tonic de la casa", short: "Gin tonic", price: 7800, cost: 2400, prep: 4 },
    { name: "Caipirinha", price: 7000, cost: 1900, prep: 5 },
    { name: "Copa de vino malbec", short: "Copa malbec", price: 5500, cost: 1800, prep: 1, skip: true },
  ]);
  await cat("Cafetería", "neutral", barra.id, 4, [
    { name: "Café espresso", short: "Espresso", price: 2600, cost: 500, prep: 3, mods: ["leche"] },
    { name: "Café con leche", price: 3400, cost: 700, prep: 3, mods: ["leche"] },
    { name: "Cortado en jarrito", short: "Cortado jarrito", price: 3000, cost: 600, prep: 3, mods: ["leche"] },
    { name: "Medialunas (3)", short: "Medialunas x3", price: 3000, cost: 900, prep: 2 },
  ]);
  await cat("Entradas", "turquesa", cocina.id, 1, [
    { name: "Rabas a la romana", short: "Rabas", price: 14500, cost: 5200, prep: 12, desc: "Con alioli de limón" },
    { name: "Provoleta a la parrilla", short: "Provoleta", price: 9800, cost: 3600, prep: 10, tags: ["vegetariano"] },
    { name: "Empanadas de carne cortada a cuchillo (2)", short: "Empanadas carne x2", price: 6400, cost: 2100, prep: 12 },
    { name: "Papas fritas con cheddar y verdeo", short: "Papas cheddar", price: 8900, cost: 2600, prep: 10, mods: ["extras"] },
    { name: "Bastones de muzzarella", short: "Bastones muzza", price: 8200, cost: 2500, prep: 8, tags: ["vegetariano"] },
  ]);
  await cat("Parrilla", "error", parrilla.id, 2, [
    { name: "Bife de chorizo 400 g", short: "Bife chorizo", price: 21500, cost: 9200, prep: 20, mods: ["punto", "guarni"] },
    { name: "Ojo de bife 350 g", short: "Ojo de bife", price: 23000, cost: 9800, prep: 20, mods: ["punto", "guarni"] },
    { name: "Vacío al punto", short: "Vacío", price: 18900, cost: 7400, prep: 22, mods: ["guarni"] },
    { name: "Pesca del día a la plancha", short: "Pesca del día", price: 19500, cost: 8200, prep: 18, mods: ["guarni"], open: true, desc: "Precio según pesca" },
  ]);
  await cat("Minutas", "accent", cocina.id, 2, [
    { name: "Milanesa napolitana con fritas", short: "Mila napo", price: 16900, cost: 6100, prep: 15, mods: ["extras", "sin"] },
    { name: "Milanesa de pollo a caballo", short: "Mila pollo caballo", price: 15200, cost: 5300, prep: 15, mods: ["guarni", "sin"] },
    { name: "Hamburguesa La Ronda", short: "Hamburguesa", price: 13800, cost: 4800, prep: 12, desc: "Doble medallón, cheddar, panceta y papas", mods: ["punto", "extras", "sin"] },
    { name: "Sorrentinos de jamón y queso", short: "Sorrentinos", price: 13500, cost: 4200, prep: 14, desc: "Con salsa a elección" },
    { name: "Ensalada César con pollo", short: "César", price: 11900, cost: 3900, prep: 8, mods: ["sin"] },
    { name: "Wok de vegetales y arroz yamaní", short: "Wok veggie", price: 11500, cost: 3200, prep: 12, tags: ["vegano"] },
    { name: "Rabas para compartir (XL)", short: "Rabas XL", price: 24000, cost: 9000, prep: 15 },
  ]);
  await cat("Postres", "violet", cocina.id, 3, [
    { name: "Flan casero con dulce de leche", short: "Flan mixto", price: 6200, cost: 1300, prep: 4 },
    { name: "Panqueques con dulce de leche", short: "Panqueques ddl", price: 6500, cost: 1500, prep: 7 },
    { name: "Helado 2 bochas", short: "Helado 2b", price: 5200, cost: 1400, prep: 3 },
    { name: "Volcán de chocolate", short: "Volcán", price: 7800, cost: 2100, prep: 10 },
  ]);

  // ── Insumos y recetas ──
  const ing = async (name: string, unit: string, stock: number, minStock: number, cost: number) =>
    prisma.ingredient.create({ data: { organizationId: orgId, name, unit, stock, minStock, cost } });
  const carne = await ing("Nalga para milanesa", "kg", 18, 6, 9800);
  const bife = await ing("Bife de chorizo", "kg", 9, 5, 16500);
  const papa = await ing("Papa", "kg", 40, 15, 900);
  const huevo = await ing("Huevos", "u", 120, 60, 180);
  const pan = await ing("Pan de hamburguesa", "u", 30, 20, 450);
  const medallon = await ing("Medallón de carne 120 g", "u", 45, 24, 1600);
  const cerveza = await ing("Cerveza rubia (barril)", "l", 38, 20, 2100);
  const ipa = await ing("Cerveza IPA (barril)", "l", 6, 10, 2600);
  const gaseosa = await ing("Gaseosa 500 ml", "u", 96, 48, 1100);
  const calamar = await ing("Rabas de calamar", "kg", 4, 5, 13500);
  const recipe = async (product: string, items: [{ id: string }, number][]) => {
    for (const [i, q] of items) await prisma.recipeItem.create({ data: { productId: products[product]!.id, ingredientId: i.id, quantity: q } });
  };
  await recipe("Milanesa napolitana con fritas", [[carne, 0.22], [papa, 0.25], [huevo, 1]]);
  await recipe("Milanesa de pollo a caballo", [[huevo, 3], [papa, 0.25]]);
  await recipe("Bife de chorizo 400 g", [[bife, 0.42]]);
  await recipe("Hamburguesa La Ronda", [[pan, 1], [medallon, 2], [papa, 0.2]]);
  await recipe("Pinta rubia tirada", [[cerveza, 0.5]]);
  await recipe("Pinta IPA tirada", [[ipa, 0.5]]);
  await recipe("Gaseosa línea Coca 500 ml", [[gaseosa, 1]]);
  await recipe("Rabas a la romana", [[calamar, 0.25]]);
  await recipe("Rabas para compartir (XL)", [[calamar, 0.45]]);
  await recipe("Papas fritas con cheddar y verdeo", [[papa, 0.35]]);

  // ── Clientes ──
  const customersData = [
    { name: "Valeria Méndez", phone: "11 5555-0101", notes: "Celíaca. Le gusta la mesa 7.", tags: ["frecuente"] },
    { name: "Hotel Costa Azul", phone: "2255 45-9000", address: "Paseo 104 y Costanera", creditLimit: 400000, tags: ["empresa"] },
    { name: "Ramiro Ibáñez", phone: "11 5555-0202", address: "Calle Los Pinos 340", addressNotes: "Timbre B", tags: [] as string[] },
    { name: "Florencia Ortiz", phone: "11 5555-0303", notes: "Vegana", tags: ["frecuente"] },
    { name: "Club de Pesca Mar de las Pampas", phone: "2255 41-2222", creditLimit: 250000, tags: ["empresa"] },
    { name: "Tomás Pereyra", phone: "11 5555-0404", birthday: new Date("1990-11-08"), tags: [] as string[] },
  ];
  const customers = [];
  for (const c of customersData) customers.push(await prisma.customer.create({ data: { organizationId: orgId, ...c } }));

  // ── Historia: 14 días de ventas cerradas ──
  const productList = Object.entries(products);
  let orderNo = 0;
  let ticketNo = 0;
  // Medianoche de hoy en Buenos Aires (el servidor puede estar en UTC).
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
  const today0 = new Date(`${ymd}T00:00:00-03:00`);
  for (let d = 14; d >= 1; d--) {
    const dayStart = new Date(today0.getTime() - d * DAY);
    const session = await prisma.cashSession.create({
      data: { organizationId: orgId, openedById: cashier.id, openingAmount: 50000, openedAt: new Date(dayStart.getTime() + 11 * 3600_000) },
    });
    const weekend = [0, 6].includes(new Date(dayStart.getTime() + 12 * 3600_000).getUTCDay());
    const nOrders = Math.floor((weekend ? 55 : 32) + rnd() * 15);
    let cashIn = 0;
    for (let n = 0; n < nOrders; n++) {
      // Picos de almuerzo y cena
      const hour = rnd() < 0.55 ? 12 + rnd() * 3.5 : 20 + rnd() * 3;
      const opened = new Date(dayStart.getTime() + hour * 3600_000);
      const closed = new Date(opened.getTime() + (40 + rnd() * 70) * 60_000);
      const typeRoll = rnd();
      const type = typeRoll < 0.72 ? "DINE_IN" : typeRoll < 0.84 ? "TAKEAWAY" : typeRoll < 0.94 ? "DELIVERY" : "COUNTER";
      const guests = type === "DINE_IN" ? 1 + Math.floor(rnd() * 5) : 1;
      const waiter = type === "DINE_IN" ? pick(waiters) : cashier;
      const nItems = Math.max(1, Math.round(guests * (1.4 + rnd())));
      const lines = Array.from({ length: nItems }, () => {
        const [name, p] = pick(productList);
        return { name, p, qty: rnd() < 0.15 ? 2 : 1 };
      });
      const subtotal = r2(lines.reduce((s, l) => s + l.p.price * l.qty, 0));
      const serviceCharge = type === "DINE_IN" ? guests * 1500 : 0;
      const discount = rnd() < 0.06 ? r2(subtotal * 0.1) : 0;
      const deliveryFee = type === "DELIVERY" ? 2500 : 0;
      const total = r2(subtotal - discount + serviceCharge + deliveryFee);
      const tip = type === "DINE_IN" && rnd() < 0.6 ? Math.round((total * 0.1) / 100) * 100 : 0;
      orderNo++;
      const method = pick(methods);
      const order = await prisma.order.create({
        data: {
          organizationId: orgId, number: orderNo, type, status: "PAID", guests, waiterId: waiter.id,
          tableId: type === "DINE_IN" ? pick(tables).id : null,
          customerId: rnd() < 0.15 ? pick(customers).id : null,
          customerName: type !== "DINE_IN" ? pick(["Juan", "Ana", "Pablo", "Mica", "Leo", "Caro"]) : null,
          fulfillment: type === "DINE_IN" ? null : "DELIVERED",
          deliveryFee, courierId: type === "DELIVERY" ? courier.id : null,
          deliveryAddress: type === "DELIVERY" ? "Calle de los Pinos 123" : null,
          subtotal, discountPct: discount ? 10 : 0, discountReason: discount ? "Cliente frecuente" : null, serviceCharge, tip, total, paidAmount: total,
          openedAt: opened, closedAt: closed,
          payments: { create: { methodId: method.id, cashSessionId: session.id, amount: total, tip, surcharge: r2(total * (method.adjustPct / 100)), createdById: cashier.id, createdAt: closed } },
        },
      });
      if (method.kind === "CASH") cashIn += total + tip;
      // Comandas con tiempos reales de cocina para el reporte
      const byStation = new Map<string, typeof lines>();
      for (const l of lines) {
        const st = l.p.categoryCourse === 0 || l.p.categoryCourse === 4 ? barra.id : l.name.includes("Bife") || l.name.includes("Ojo") || l.name.includes("Vacío") || l.name.includes("Pesca") ? parrilla.id : cocina.id;
        byStation.set(st, [...(byStation.get(st) ?? []), l]);
      }
      for (const [stationId, ls] of byStation) {
        ticketNo++;
        const sent = new Date(opened.getTime() + 4 * 60_000);
        const prep = (stationId === barra.id ? 3 : stationId === parrilla.id ? 19 : 13) + rnd() * 9;
        const ready = new Date(sent.getTime() + prep * 60_000);
        const ticket = await prisma.kitchenTicket.create({
          data: { organizationId: orgId, orderId: order.id, stationId, number: ticketNo, status: "DONE", createdAt: sent, startedAt: new Date(sent.getTime() + 60_000), readyAt: ready, doneAt: new Date(ready.getTime() + 2 * 60_000) },
        });
        for (const l of ls) {
          await prisma.orderItem.create({
            data: {
              orderId: order.id, productId: l.p.id, stationId, ticketId: ticket.id, name: l.name, unitPrice: l.p.price, quantity: l.qty, total: r2(l.p.price * l.qty),
              course: l.p.categoryCourse, status: "SERVED", sentAt: sent, readyAt: ready, servedAt: ready, createdAt: opened, createdById: waiter.id,
            },
          });
        }
      }
    }
    const expected = r2(50000 + cashIn - 15000);
    await prisma.cashMovement.create({ data: { cashSessionId: session.id, kind: "OUT", amount: 15000, reason: "Pago a proveedor de hielo", userId: cashier.id, createdAt: new Date(dayStart.getTime() + 17 * 3600_000) } });
    const counted = r2(expected + (rnd() < 0.7 ? 0 : Math.round((rnd() - 0.5) * 4000)));
    await prisma.cashSession.update({
      where: { id: session.id },
      data: { closedAt: new Date(dayStart.getTime() + 24.5 * 3600_000), closedById: cashier.id, expectedCash: expected, countedCash: counted, difference: r2(counted - expected) },
    });
  }

  // ── Hoy: caja abierta y servicio en marcha ──
  const now = Date.now();
  const todaySession = await prisma.cashSession.create({ data: { organizationId: orgId, openedById: cashier.id, openingAmount: 50000, openedAt: new Date(now - 3 * 3600_000) } });
  const byName = (n: string) => ({ ...products[n]!, name: n });
  const live = async (o: {
    table?: string; type?: string; guests: number; waiter: { id: string; name: string }; minutesAgo: number; status?: string; customerName?: string; fulfillment?: string;
    items: { p: string; qty?: number; status: string; ago?: number; mods?: { groupName: string; name: string; priceDelta: number }[]; notes?: string }[];
  }) => {
    orderNo++;
    const type = o.type ?? "DINE_IN";
    const table = o.table ? tables.find((t) => t.name === o.table)! : null;
    const opened = new Date(now - o.minutesAgo * 60_000);
    const lines = o.items.map((i) => ({ ...i, prod: byName(i.p), qty: i.qty ?? 1 }));
    const subtotal = r2(lines.reduce((s, l) => s + (l.prod.price + (l.mods ?? []).reduce((a, m) => a + m.priceDelta, 0)) * l.qty, 0));
    const serviceCharge = type === "DINE_IN" ? o.guests * 1500 : 0;
    const order = await prisma.order.create({
      data: {
        organizationId: orgId, number: orderNo, type, status: o.status ?? "OPEN", guests: o.guests, waiterId: o.waiter.id, tableId: table?.id,
        customerName: o.customerName, fulfillment: o.fulfillment ?? (type === "DINE_IN" ? null : "PREPARING"),
        subtotal, serviceCharge, total: r2(subtotal + serviceCharge), openedAt: opened, billPrintedAt: o.status === "BILLING" ? new Date(now - 2 * 60_000) : null,
      },
    });
    const sentGroups = new Map<string, typeof lines>();
    for (const l of lines) {
      const st = l.prod.categoryCourse === 0 || l.prod.categoryCourse === 4 ? barra.id : /Bife|Ojo|Vacío|Pesca/.test(l.p) ? parrilla.id : cocina.id;
      if (["SENT", "PREPARING", "READY", "SERVED"].includes(l.status)) sentGroups.set(`${st}|${l.ago ?? o.minutesAgo - 3}`, [...(sentGroups.get(`${st}|${l.ago ?? o.minutesAgo - 3}`) ?? []), l]);
      else {
        await prisma.orderItem.create({
          data: { orderId: order.id, productId: l.prod.id, stationId: st, name: l.p, unitPrice: l.prod.price, quantity: l.qty, total: r2(l.prod.price * l.qty), course: l.prod.categoryCourse, status: l.status, modifiers: l.mods ?? [], notes: l.notes, createdById: o.waiter.id },
        });
      }
    }
    for (const [key, ls] of sentGroups) {
      const [stationId, ago] = key.split("|");
      ticketNo++;
      const sent = new Date(now - Number(ago) * 60_000);
      const allReady = ls.every((l) => l.status === "READY" || l.status === "SERVED");
      const anyStarted = ls.some((l) => l.status !== "SENT");
      const allServed = ls.every((l) => l.status === "SERVED");
      const ticket = await prisma.kitchenTicket.create({
        data: {
          organizationId: orgId, orderId: order.id, stationId: stationId!, number: ticketNo, createdAt: sent,
          status: allServed ? "DONE" : allReady ? "READY" : anyStarted ? "PREPARING" : "NEW",
          startedAt: anyStarted ? new Date(sent.getTime() + 60_000) : null, readyAt: allReady ? new Date(now - 60_000) : null, doneAt: allServed ? new Date(now - 30_000) : null,
        },
      });
      for (const l of ls) {
        const unit = l.prod.price + (l.mods ?? []).reduce((a, m) => a + m.priceDelta, 0);
        await prisma.orderItem.create({
          data: {
            orderId: order.id, productId: l.prod.id, stationId, ticketId: ticket.id, name: l.p, unitPrice: unit, quantity: l.qty, total: r2(unit * l.qty), course: l.prod.categoryCourse,
            status: l.status, sentAt: sent, modifiers: l.mods ?? [], notes: l.notes, createdById: o.waiter.id,
            readyAt: l.status === "READY" || l.status === "SERVED" ? new Date(now - 60_000) : null, servedAt: l.status === "SERVED" ? new Date(now - 30_000) : null,
          },
        });
      }
    }
    return order;
  };
  const jugoso = [{ groupName: "Punto de la carne", name: "Jugoso", priceDelta: 0 }, { groupName: "Guarnición", name: "Papas fritas", priceDelta: 0 }];
  await live({ table: "1", guests: 4, waiter: lucia, minutesAgo: 35, items: [
    { p: "Pinta rubia tirada", qty: 2, status: "SERVED" }, { p: "Gaseosa línea Coca 500 ml", qty: 2, status: "SERVED" },
    { p: "Bife de chorizo 400 g", qty: 2, status: "PREPARING", ago: 18, mods: jugoso }, { p: "Milanesa napolitana con fritas", qty: 2, status: "PREPARING", ago: 18, notes: "Una sin jamón" },
  ] });
  await live({ table: "3", guests: 2, waiter: martin, minutesAgo: 22, items: [
    { p: "Aperol spritz", qty: 2, status: "SERVED" }, { p: "Rabas a la romana", status: "READY", ago: 14 }, { p: "Sorrentinos de jamón y queso", qty: 2, status: "HOLD" },
  ] });
  await live({ table: "5", guests: 6, waiter: lucia, minutesAgo: 70, status: "BILLING", items: [
    { p: "Pinta IPA tirada", qty: 4, status: "SERVED" }, { p: "Hamburguesa La Ronda", qty: 3, status: "SERVED" }, { p: "Ensalada César con pollo", qty: 2, status: "SERVED" },
    { p: "Flan casero con dulce de leche", qty: 3, status: "SERVED" },
  ] });
  await live({ table: "8", guests: 3, waiter: nico, minutesAgo: 28, items: [
    { p: "Fernet con coca", qty: 3, status: "SERVED" }, { p: "Ojo de bife 350 g", status: "SENT", ago: 21, mods: [{ groupName: "Punto de la carne", name: "A punto", priceDelta: 0 }, { groupName: "Guarnición", name: "Puré", priceDelta: 0 }] },
    { p: "Vacío al punto", qty: 2, status: "SENT", ago: 21, mods: [{ groupName: "Guarnición", name: "Ensalada mixta", priceDelta: 0 }] },
  ] });
  await live({ table: "S2", guests: 4, waiter: martin, minutesAgo: 12, items: [
    { p: "Limonada con menta y jengibre", qty: 4, status: "PREPARING", ago: 6 }, { p: "Papas fritas con cheddar y verdeo", status: "DRAFT" }, { p: "Bastones de muzzarella", status: "DRAFT" },
  ] });
  await live({ table: "S4", guests: 2, waiter: martin, minutesAgo: 5, items: [{ p: "Caipirinha", qty: 2, status: "SENT", ago: 3 }] });
  await live({ table: "23", guests: 4, waiter: nico, minutesAgo: 40, items: [
    { p: "Empanadas de carne cortada a cuchillo (2)", qty: 2, status: "SERVED" }, { p: "Milanesa de pollo a caballo", qty: 2, status: "READY", ago: 16, mods: [{ groupName: "Guarnición", name: "Puré", priceDelta: 0 }] },
    { p: "Wok de vegetales y arroz yamaní", status: "READY", ago: 16 }, { p: "Copa de vino malbec", qty: 2, status: "SERVED" },
  ] });
  await live({ type: "TAKEAWAY", guests: 1, waiter: cashier, minutesAgo: 9, customerName: "Pablo", items: [{ p: "Hamburguesa La Ronda", qty: 2, status: "PREPARING", ago: 7 }] });
  await live({ type: "DELIVERY", guests: 1, waiter: cashier, minutesAgo: 25, customerName: "Ramiro Ibáñez", fulfillment: "READY", items: [{ p: "Milanesa napolitana con fritas", status: "READY", ago: 20 }, { p: "Gaseosa línea Coca 500 ml", qty: 2, status: "SERVED" }] });

  // Una mesa llama desde el QR
  const t7 = tables.find((t) => t.name === "8")!;
  await prisma.serviceRequest.create({ data: { organizationId: orgId, tableId: t7.id, kind: "CALL_WAITER", createdAt: new Date(now - 60_000) } });

  // Cobros de hoy (para que la caja abierta tenga movimiento)
  for (let i = 0; i < 9; i++) {
    orderNo++;
    const [name, p] = pick(productList);
    const total = r2(p.price * 2 + 3000);
    const at = new Date(now - (150 - i * 14) * 60_000);
    const method = pick(methods);
    await prisma.order.create({
      data: {
        organizationId: orgId, number: orderNo, type: "DINE_IN", status: "PAID", guests: 2, waiterId: pick(waiters).id, tableId: pick(tables).id,
        subtotal: p.price * 2, serviceCharge: 3000, total, paidAmount: total, openedAt: new Date(at.getTime() - 50 * 60_000), closedAt: at,
        items: { create: { productId: p.id, name, unitPrice: p.price, quantity: 2, total: p.price * 2, status: "SERVED", course: p.categoryCourse } },
        payments: { create: { methodId: method.id, cashSessionId: todaySession.id, amount: total, surcharge: r2(total * (method.adjustPct / 100)), createdById: cashier.id, createdAt: at } },
      },
    });
  }

  // Reservas de hoy y mañana + lista de espera
  const at = (h: number, m = 0, dayOffset = 0) => new Date(today0.getTime() + dayOffset * DAY + (h * 60 + m) * 60_000);
  await prisma.reservation.createMany({
    data: [
      { organizationId: orgId, name: "Familia Romero", phone: "11 5555-1111", partySize: 6, dateTime: at(21, 0), tableId: tables.find((t) => t.name === "4")!.id, notes: "Cumpleaños, traen torta" },
      { organizationId: orgId, name: "Valeria Méndez", phone: "11 5555-0101", partySize: 2, dateTime: at(21, 30), customerId: customers[0]!.id, notes: "Celíaca" },
      { organizationId: orgId, name: "Grupo de surf", phone: "11 5555-2222", partySize: 10, dateTime: at(13, 0, 1), areaPreference: "Playa" },
      { organizationId: orgId, kind: "WAITLIST", name: "Martina", phone: "11 5555-3333", partySize: 3, dateTime: new Date(now - 8 * 60_000), quotedMinutes: 20, status: "PENDING" },
    ],
  });

  await prisma.counter.createMany({ data: [{ organizationId: orgId, key: "order", value: orderNo }, { organizationId: orgId, key: "ticket", value: ticketNo }] });

  console.log(`
Listo: "${org.name}"
  Entrar con email:  duenio@ronda.app / ronda1234   (encargado@ronda.app / ronda1234)
  PINs:              Sofía 1111 · Diego 2222 · Carla (caja) 3333 · Lucía 4444 · Martín 5555 · Nicolás 8888 · Cocina 6666 · Repartidor 7777
  Vincular equipos:  /vincular → 111111 caja · 222222 tablet mozo · 333333 pantalla cocina · 444444 pantalla barra · 555555 pantalla de retiro
`);
  void owner; void manager; void transfer; void qr; void credito; void debito;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
