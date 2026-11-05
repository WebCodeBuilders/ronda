/** Bloque de carga animado. Reservar el mismo tamaño que el contenido real evita saltos de layout. */
export function Skeleton({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-surface-secondary ${className}`}
      style={style}
    />
  );
}

/** Tarjeta-esqueleto con el mismo radio/borde que las tarjetas reales. */
export function SkeletonCard({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border bg-surface p-4 ${className}`}>
      {children}
    </div>
  );
}
