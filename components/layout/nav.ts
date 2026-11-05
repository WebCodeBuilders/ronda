import type { Permission } from "@/lib/permissions";

/**
 * El menú, en un solo lugar. Cada pantalla dice qué permiso la abre; el menú,
 * la barra móvil y el control del servidor leen de acá.
 */
export type NavKey =
  | "home" | "salon" | "counter" | "delivery" | "kitchen" | "reservations"
  | "orders" | "cash" | "customers" | "menu" | "stock" | "reports" | "settings";

export type NavItem = { key: NavKey; href: string; label: string; anyOf: Permission[] };
export type NavGroup = { id: string; label: string; items: NavItem[] };

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "operacion",
    label: "Operación",
    items: [
      { key: "home", href: "/", label: "Inicio", anyOf: ["reports.view", "cash.manage"] },
      { key: "salon", href: "/salon", label: "Salón", anyOf: ["salon.view"] },
      { key: "counter", href: "/mostrador", label: "Mostrador", anyOf: ["orders.create"] },
      { key: "delivery", href: "/delivery", label: "Delivery y retiro", anyOf: ["delivery.manage"] },
      { key: "kitchen", href: "/cocina", label: "Cocina", anyOf: ["kitchen.view"] },
      { key: "reservations", href: "/reservas", label: "Reservas", anyOf: ["reservations.manage"] },
    ],
  },
  {
    id: "ventas",
    label: "Ventas",
    items: [
      { key: "orders", href: "/pedidos", label: "Pedidos", anyOf: ["orders.charge", "reports.view"] },
      { key: "cash", href: "/caja", label: "Caja", anyOf: ["cash.manage"] },
      { key: "customers", href: "/clientes", label: "Clientes", anyOf: ["customers.manage"] },
    ],
  },
  {
    id: "gestion",
    label: "Gestión",
    items: [
      { key: "menu", href: "/carta", label: "Carta", anyOf: ["menu.manage", "menu.availability"] },
      { key: "stock", href: "/insumos", label: "Insumos", anyOf: ["stock.manage"] },
      { key: "reports", href: "/reportes", label: "Reportes", anyOf: ["reports.view"] },
      { key: "settings", href: "/configuracion", label: "Configuración", anyOf: ["settings.manage", "users.manage"] },
    ],
  },
];

export function visibleNav(perms: Set<Permission> | Permission[]): NavGroup[] {
  const set = perms instanceof Set ? perms : new Set(perms);
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.anyOf.some((p) => set.has(p))) })).filter((g) => g.items.length > 0);
}

/** Las cuatro de la barra de abajo en el celular, según lo que la persona usa. */
export function mobileTabs(groups: NavGroup[]): NavItem[] {
  const all = groups.flatMap((g) => g.items);
  const order: NavKey[] = ["salon", "counter", "kitchen", "delivery", "cash", "home", "orders"];
  return order.map((k) => all.find((i) => i.key === k)).filter((x): x is NavItem => !!x).slice(0, 4);
}

export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}
