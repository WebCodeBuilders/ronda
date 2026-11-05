import Link from "next/link";
import { Banknote, Building2, ChevronRight, ChefHat, History, LayoutGrid, MonitorSmartphone, QrCode, UserCog } from "lucide-react";
import { pageUser } from "@/lib/auth/guard";
import { PageContainer } from "@/components/shared/PageContainer";
import { PageHeader } from "@/components/shared/PageHeader";

export const metadata = { title: "Configuración · ronda" };

const ITEMS = [
  { href: "/configuracion/negocio", icon: Building2, title: "Negocio", desc: "Datos, cubierto, propina sugerida, reglas de anulación, carta QR y la impresora de la caja.", perm: "settings.manage" },
  { href: "/salon?editar=1", icon: LayoutGrid, title: "Salón y mesas", desc: "Sectores, mesas, sombrillas y reposeras. Plano con arrastrar y soltar.", perm: "settings.manage" },
  { href: "/configuracion/estaciones", icon: ChefHat, title: "Estaciones e impresoras", desc: "Cocina, parrilla, barra: pantalla, comandera de red, copias y prueba de impresión.", perm: "settings.manage" },
  { href: "/configuracion/medios-de-pago", icon: Banknote, title: "Medios de pago", desc: "Efectivo, tarjetas con recargo, transferencias, QR, cuenta corriente.", perm: "settings.manage" },
  { href: "/configuracion/usuarios", icon: UserCog, title: "Usuarios y permisos", desc: "Mozos, cajeros, cocina. PIN para entrar rápido en las terminales.", perm: "users.manage" },
  { href: "/configuracion/equipos", icon: MonitorSmartphone, title: "Equipos", desc: "Vinculá tablets, celulares, la caja y las pantallas de cocina con un código.", perm: "settings.manage" },
  { href: "/configuracion/qr", icon: QrCode, title: "QR de las mesas", desc: "Carta digital, pedir desde la mesa, llamar al mozo y pedir la cuenta. Para imprimir.", perm: "settings.manage" },
  { href: "/configuracion/historial", icon: History, title: "Historial", desc: "Anulaciones, descuentos, reaperturas, caja y cambios de precio: quién, cuándo y por qué.", perm: "settings.manage" },
] as const;

export default async function SettingsPage() {
  const user = await pageUser("settings.manage", "users.manage");
  const items = ITEMS.filter((i) => user.permissions.has(i.perm));
  return (
    <PageContainer width="default">
      <PageHeader title="Configuración" />
      <div className="rounded-2xl border border-border bg-surface divide-y divide-border sm:divide-y-0 sm:border-0 sm:bg-transparent sm:grid sm:grid-cols-2 sm:gap-3">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className="flex items-center gap-3 px-4 py-3 sm:rounded-2xl sm:border sm:border-border sm:bg-surface sm:p-4 hover:bg-surface-secondary transition-colors">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text-primary">{i.title}</p>
              <p className="text-xs text-text-secondary leading-snug mt-0.5">{i.desc}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
          </Link>
        ))}
      </div>
    </PageContainer>
  );
}
