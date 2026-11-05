import {
  BarChart3, Bike, BookOpen, CalendarDays, ChefHat, ClipboardList, House, LayoutGrid, Settings, ShoppingCart, Users, Wallet, Warehouse,
  type LucideIcon,
} from "lucide-react";
import type { NavKey } from "./nav";

/** Un ícono por entidad, el mismo en toda la app. */
export const NAV_ICONS: Record<NavKey, LucideIcon> = {
  home: House,
  salon: LayoutGrid,
  counter: ShoppingCart,
  delivery: Bike,
  kitchen: ChefHat,
  reservations: CalendarDays,
  orders: ClipboardList,
  cash: Wallet,
  customers: Users,
  menu: BookOpen,
  stock: Warehouse,
  reports: BarChart3,
  settings: Settings,
};
