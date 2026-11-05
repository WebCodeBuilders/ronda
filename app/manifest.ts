import type { MetadataRoute } from "next";

/** Instalable como app en la tablet del mozo y en la pantalla de cocina. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ronda",
    short_name: "ronda",
    description: "Gestión gastronómica: salón, comandas, cocina y caja.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F7FA",
    theme_color: "#0A3D62",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
