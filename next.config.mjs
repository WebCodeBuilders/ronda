// @ts-check
/**
 * Encabezados de seguridad para todas las respuestas. La carta QR y el resto
 * de la app no se pueden meter en un iframe de otro sitio (clickjacking).
 * En .mjs a propósito: la imagen de producción no trae TypeScript.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  // `pg` abre sockets y `net` (impresoras ESC/POS) es de Node: no se empaquetan.
  serverExternalPackages: ["pg"],
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
