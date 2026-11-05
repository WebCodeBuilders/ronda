/**
 * Permisos de ronda. El código pregunta SIEMPRE por un permiso, nunca por el
 * nombre de un rol: así un rol nuevo (o uno a medida) no obliga a tocar pantallas.
 */
export const PERMISSIONS = [
  "salon.view",
  "orders.create",
  "orders.edit",
  "orders.send",
  "orders.void",
  "orders.discount",
  "orders.transfer",
  "orders.charge",
  "orders.reopen",
  "orders.cancel",
  "cash.manage",
  "kitchen.view",
  "delivery.manage",
  "customers.manage",
  "reservations.manage",
  "menu.manage",
  "menu.availability",
  "stock.manage",
  "reports.view",
  "settings.manage",
  "users.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = ["OWNER", "MANAGER", "CASHIER", "WAITER", "KITCHEN", "DELIVERY"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  OWNER: "Dueño",
  MANAGER: "Encargado",
  CASHIER: "Cajero",
  WAITER: "Mozo",
  KITCHEN: "Cocina / Barra",
  DELIVERY: "Repartidor",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  OWNER: "Todo, incluida la configuración y los usuarios.",
  MANAGER: "Todo lo operativo: anula, descuenta, reabre y ve reportes.",
  CASHIER: "Cobra, maneja la caja, toma pedidos de mostrador y delivery.",
  WAITER: "Abre mesas, carga y marcha pedidos, pide la cuenta.",
  KITCHEN: "Ve las comandas de su estación y marca platos sin stock.",
  DELIVERY: "Ve sus repartos y los marca entregados.",
};

const ALL = new Set<Permission>(PERMISSIONS);

const BY_ROLE: Record<Role, Permission[]> = {
  OWNER: [...PERMISSIONS],
  MANAGER: PERMISSIONS.filter((p) => p !== "users.manage" && p !== "settings.manage"),
  CASHIER: [
    "salon.view", "orders.create", "orders.edit", "orders.send", "orders.transfer", "orders.charge",
    "cash.manage", "kitchen.view", "delivery.manage", "customers.manage", "reservations.manage", "menu.availability",
  ],
  WAITER: ["salon.view", "orders.create", "orders.edit", "orders.send", "orders.transfer", "kitchen.view", "reservations.manage"],
  KITCHEN: ["kitchen.view", "menu.availability"],
  DELIVERY: ["delivery.manage"],
};

export function permissionsFor(role: string): Set<Permission> {
  if (role in BY_ROLE) return new Set(BY_ROLE[role as Role]);
  return new Set();
}

export function roleLabel(role: string): string {
  return ROLE_LABELS[role as Role] ?? role;
}

export function isPermission(p: string): p is Permission {
  return ALL.has(p as Permission);
}
