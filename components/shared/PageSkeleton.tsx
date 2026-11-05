import { Skeleton } from "@/components/ui/Skeleton";
import { PageContainer } from "@/components/shared/PageContainer";
import { tableCls } from "@/components/ui/table-styles";

type Variant = "cards" | "list" | "detail" | "form";
type Width = "narrow" | "default" | "wide" | "full";

/**
 * Esqueleto de página con cuatro formas.
 *
 * Existe porque un `loading.tsx` cubre su segmento Y todos los de abajo que no
 * tengan el propio: sin una red genérica en `[orgSlug]`, cincuenta y una
 * pantallas se cargaban SIN ningún aviso — la app quedaba congelada en la
 * pantalla anterior hasta que el servidor terminaba.
 *
 * Calca la ESTRUCTURA real (octubre 2026, el dueño notó que los esqueletos "no
 * coincidían"): el encabezado mide lo mismo que `PageHeader` (en celular las
 * acciones van abajo del título), el listado tiene la cabecera compacta de
 * `ListFilters` y filas de la altura de `tableCls` (~34px), y cada pantalla le
 * pasa el MISMO ancho que su `PageContainer`, así nada salta al llegar los datos.
 */
export function PageSkeleton({
  variant = "cards",
  width = "wide",
  actions = 1,
  back = false,
}: {
  variant?: Variant;
  width?: Width;
  /** Cuántos botones lleva el encabezado. */
  actions?: number;
  /** La pantalla tiene "volver" arriba del título. */
  back?: boolean;
}) {
  return (
    <PageContainer width={width}>
      {back && <Skeleton className="mb-5 h-5 w-28" />}
      <HeaderSkeleton actions={actions} />
      {variant === "cards" && <CardsBody />}
      {variant === "list" && <ListBody />}
      {variant === "detail" && <DetailBody />}
      {variant === "form" && <FormBody />}
    </PageContainer>
  );
}

/** Mismo alto y misma disposición que `PageHeader`. */
export function HeaderSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <Skeleton className="h-7 w-44 sm:h-8" />
        <Skeleton className="h-4 w-60" />
      </div>
      {actions > 0 && (
        <div className="flex gap-2 *:flex-1 sm:*:flex-none">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className={`h-11 rounded-2xl lg:h-10 ${i === 0 ? "sm:w-36" : "sm:w-28"}`} />
          ))}
        </div>
      )}
    </div>
  );
}

/** Tablero: listas compactas etiqueta/valor en dos columnas (Inicio, Caja). */
function CardsBody() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {[0, 1].map((c) => (
          <div key={c} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <Skeleton className="mx-4 mb-2 mt-3 h-3 w-20" />
            {[0, 1, 2].map((r) => (
              <div key={r} className="flex items-center justify-between border-t border-border px-4 py-3">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[0, 1].map((c) => (
          <div key={c} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Listado: cabecera compacta de filtros + tabla (escritorio) / tarjetas (celular). */
function ListBody() {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Skeleton className="h-11 min-w-0 basis-full rounded-2xl sm:basis-80 sm:grow lg:h-10 lg:max-w-md" />
        <Skeleton className="h-11 w-36 rounded-2xl lg:h-10" />
        <Skeleton className="h-11 w-32 rounded-2xl lg:h-10" />
        <Skeleton className="ml-auto hidden h-4 w-20 lg:block" />
      </div>

      {/* Celular: tarjetas */}
      <div className="space-y-2 lg:hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-1/4" />
              </div>
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-3 border-t border-border pt-2.5">
              <Skeleton className="h-3" />
              <Skeleton className="h-3" />
            </div>
          </div>
        ))}
      </div>

      {/* Escritorio: el marco y la densidad de `tableCls` */}
      <div className={`hidden lg:block ${tableCls.frame}`}>
        <div className={`flex items-center gap-4 px-4 py-2.5 ${tableCls.thead}`}>
          {[20, 28, 0, 16, 20].map((w, i) => (
            <Skeleton key={i} className={`h-3 ${w === 0 ? "flex-1" : ""}`} style={w ? { width: `${w * 4}px` } : undefined} />
          ))}
        </div>
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex h-8.5 items-center gap-4 border-t border-border px-4">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3.5 flex-1" />
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </>
  );
}

/** Ficha: tarjetas apiladas (Pedido, Cliente, Proveedor, Trabajo). */
function DetailBody() {
  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[0, 1, 2, 3].map((r) => (
            <div key={r} className="space-y-1.5">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <Skeleton className="mx-4 mb-2 mt-3 h-3 w-24" />
        {[0, 1, 2, 3].map((r) => (
          <div key={r} className="flex items-center justify-between border-t border-border px-4 py-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-20" />
          </div>
        ))}
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
        <Skeleton className="h-4 w-20" />
        {[0, 1, 2].map((r) => (
          <div key={r} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/4" />
            </div>
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Formulario / configuración: tarjetas con campos y la barra de guardar. */
function FormBody() {
  return (
    <div className="space-y-4">
      {[4, 3].map((n, c) => (
        <div key={c} className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: n }).map((_, r) => (
            <div key={r} className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-11 w-full rounded-2xl lg:h-10" />
            </div>
          ))}
        </div>
      ))}
      <div className="flex justify-end gap-2">
        <Skeleton className="h-11 w-24 rounded-2xl" />
        <Skeleton className="h-11 w-36 rounded-2xl" />
      </div>
    </div>
  );
}
