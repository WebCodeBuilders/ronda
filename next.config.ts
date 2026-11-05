import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build autocontenido: el servidor del local (o Docker) arranca con `node server.js`.
  output: "standalone",
  // `pg` abre sockets y `net` (impresoras ESC/POS) es de Node: no se empaquetan.
  serverExternalPackages: ["pg"],
};

export default nextConfig;
