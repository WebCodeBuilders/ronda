import Link from "next/link";
import { ChevronRight } from "lucide-react";

/**
 * Datos y KPIs como MercadoPago: una lista compacta con una fila por dato
 * ("etiqueta a la izquierda, valor a la derecha"), no una tarjeta grande con
 * ícono por número. Nació en el Inicio y se comparte para que el resto de las
 * pantallas de datos (ficha de cliente, turno de caja, proveedor, superadmin)
 * se lean igual.
 */
export function StatList({ title, children, className = "" }: { title?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-border bg-surface ${className}`}>
      {title && (
        <p className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </p>
      )}
      <div className={title ? undefined : "[&>*:first-child]:border-t-0"}>{children}</div>
    </div>
  );
}

/**
 * Fila de indicador. El color solo resalta el valor cuando aporta lectura
 * (verde ingreso, ámbar alerta, rojo deuda); `href` la vuelve un link con chevron.
 */
export function StatRow({ label, value, sub, color, href }: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  color?: string;
  href?: string;
}) {
  const inner = (
    <>
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="flex min-w-0 items-center gap-1.5 text-right">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold tabular-nums" style={{ color: color ?? "var(--text-primary)" }}>
            {value}
          </span>
          {sub && <span className="block text-xs text-text-muted">{sub}</span>}
        </span>
        {href && <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />}
      </span>
    </>
  );
  const cls = "flex items-center justify-between gap-3 border-t border-border px-4 py-2.5";
  return href
    ? <Link href={href} className={`${cls} transition-colors hover:bg-surface-secondary`}>{inner}</Link>
    : <div className={cls}>{inner}</div>;
}
