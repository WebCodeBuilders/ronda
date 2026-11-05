import React from "react";

type Width = "narrow" | "default" | "wide" | "full";

const MAX: Record<Width, string> = {
  // 768px: en 672 las pantallas de configuración con listas dejaban media
  // pantalla vacía a los costados (devolución del cliente, 09/2026).
  narrow: "max-w-3xl",   // formularios / detalle
  default: "max-w-4xl",  // contenido medio
  wide: "max-w-6xl",     // listados / tablas
  full: "max-w-none",    // POS y pantallas a todo el ancho
};

/**
 * Contenedor base de página: ancho completo hasta un máximo, centrado por el
 * layout. Unifica el ancho/centrado de todas las páginas (diseño centrado + redondeado).
 */
export function PageContainer({
  width = "default",
  className = "",
  children,
}: {
  width?: Width;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`w-full ${MAX[width]} ${className}`}>{children}</div>;
}
