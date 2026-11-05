"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Menu, MoreHorizontal, X } from "lucide-react";
import { LogoMark } from "@/components/brand/Logo";
import { isActive, mobileTabs, type NavGroup } from "./nav";
import { NAV_ICONS } from "./nav-icons";
import { useActiveNavHref } from "./nav-override";
import { LiveIndicator } from "./LiveIndicator";
import { NotificationsCenter } from "./NotificationsCenter";
import { api } from "@/lib/client/api";
import { initials, solidColor } from "@/lib/colors";
import { roleLabel } from "@/lib/permissions";
import { cn } from "@/lib/utils";

export type ShellUser = { id: string; name: string; role: string; color: string; orgName: string; onDevice: boolean };

export function AppShell({ user, groups, children }: { user: ShellUser; groups: NavGroup[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const tabs = mobileTabs(groups);
  // Las pantallas de trabajo (el pedido abierto) usan todo el alto sin el padding de página.
  const bleed = /^\/pedidos\/[^/]+$/.test(pathname);
  const override = useActiveNavHref();
  const isActive_ = (href: string) => (override ? href === override : isActive(href, pathname));

  async function lock(full: boolean) {
    const r = await api<{ next: string }>("/api/auth/logout", { body: { full } }).catch(() => ({ next: "/login" }));
    window.location.href = full ? "/login" : r.next;
  }

  const sidebar = (variant: "desktop" | "drawer") => (
    <aside className={cn("flex flex-col bg-surface border-r border-border", variant === "desktop" ? "hidden lg:flex w-60 shrink-0 h-dvh sticky top-0" : "w-72 h-full")}>
      <div className="flex items-center gap-2.5 px-4 h-14 shrink-0 bg-accent text-white">
        <LogoMark className="w-7 h-7" />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight tracking-tight">ronda</p>
          <p className="text-[11px] text-white/70 truncate leading-tight">{user.orgName}</p>
        </div>
        {variant === "drawer" && (
          <button onClick={() => setDrawer(false)} className="tap-44 -mr-2 flex items-center justify-center rounded-xl text-white/80 hover:bg-white/15" aria-label="Cerrar menú">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
      <nav className="flex-1 overflow-y-auto scroll-contain p-2 space-y-3">
        {groups.map((g) => (
          <div key={g.id}>
            <p className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">{g.label}</p>
            <div className="space-y-0.5">
              {g.items.map((it) => {
                const Icon = NAV_ICONS[it.key];
                const active = isActive_(it.href);
                return (
                  <Link
                    key={it.key}
                    href={it.href}
                    onClick={() => setDrawer(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                      variant === "drawer" ? "h-12" : "h-9",
                      active ? "bg-accent-light text-accent" : "text-text-secondary hover:bg-surface-secondary hover:text-text-primary",
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="shrink-0 border-t border-border p-2 space-y-1">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold text-white shrink-0" style={{ background: solidColor(user.color) }}>
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-text-primary truncate">{user.name}</p>
            <p className="text-xs text-text-muted truncate">{roleLabel(user.role)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {user.onDevice && (
            <button onClick={() => lock(false)} className="flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold text-text-secondary hover:bg-surface-secondary">
              Bloquear
            </button>
          )}
          <button onClick={() => lock(true)} className={cn("flex items-center justify-center gap-1.5 h-9 rounded-xl text-xs font-semibold text-text-secondary hover:bg-surface-secondary", !user.onDevice && "col-span-2")}>
            Salir
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-dvh">
      {sidebar("desktop")}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40 fs-overlay-in" onClick={() => setDrawer(false)} />
          <div className="absolute inset-y-0 left-0 fs-slide-in-left pt-safe">{sidebar("drawer")}</div>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-40 h-14 shrink-0 flex items-center gap-2 px-3 lg:px-6 bg-surface/95 backdrop-blur border-b border-border pt-safe">
          <button onClick={() => setDrawer(true)} className="tap-44 lg:hidden -ml-1 flex items-center justify-center rounded-xl text-text-secondary hover:bg-surface-secondary" aria-label="Abrir menú">
            <Menu className="w-5 h-5" />
          </button>
          <span className="lg:hidden flex items-center gap-1.5 text-accent font-bold tracking-tight">
            <LogoMark className="w-6 h-6" /> ronda
          </span>
          <div className="flex-1" />
          <LiveIndicator />
          <NotificationsCenter userId={user.id} />
          {user.onDevice && (
            <button onClick={() => lock(false)} className="hidden sm:flex lg:hidden items-center gap-1.5 h-9 px-3 rounded-xl text-xs font-semibold text-text-secondary hover:bg-surface-secondary">
              Bloquear
            </button>
          )}
        </header>
        <main className={cn("flex-1 min-w-0", bleed ? "" : "px-4 pt-4 lg:px-6 lg:py-6 pb-[calc(var(--tabbar-total)+1rem)] lg:pb-6")}>
          <div className={cn(!bleed && "mx-auto w-full flex justify-center")}>{children}</div>
        </main>
        {tabs.length > 0 && !bleed && (
          <nav className="fixed bottom-0 inset-x-0 z-40 lg:hidden border-t border-border bg-surface pb-safe">
            <div className="flex items-stretch h-[var(--tabbar-h)]">
              {tabs.map((t) => {
                const Icon = NAV_ICONS[t.key];
                const active = isActive_(t.href);
                return (
                  <Link key={t.key} href={t.href} className={cn("flex-1 flex flex-col items-center justify-center gap-1", active ? "text-accent" : "text-text-muted")}>
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-medium leading-none truncate max-w-full px-1">{t.label}</span>
                  </Link>
                );
              })}
              <button onClick={() => setDrawer(true)} className="flex-1 flex flex-col items-center justify-center gap-1 text-text-muted">
                <MoreHorizontal className="w-5 h-5" />
                <span className="text-[10px] font-medium leading-none">Más</span>
              </button>
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
