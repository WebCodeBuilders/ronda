/** Mientras carga una pantalla: el esqueleto ocupa el mismo lugar, sin saltos. */
export default function Loading() {
  return (
    <div className="w-full animate-pulse" aria-busy="true" aria-label="Cargando">
      <div className="h-8 w-48 rounded-xl bg-surface-secondary mb-6" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-surface-secondary" />)}
      </div>
      <div className="h-80 rounded-2xl bg-surface-secondary" />
    </div>
  );
}
