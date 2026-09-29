import path from "node:path";
import type { NextConfig } from "next";

const root = path.resolve(__dirname);

const nextConfig: NextConfig = {
  // Este proyecto vive dentro de otro repositorio: fijamos la raíz para que
  // Turbopack no use el package.json/instrumentation del proyecto padre.
  turbopack: { root },
  outputFileTracingRoot: root,
  poweredByHeader: false,
  // El indicador de desarrollo tapa los controles del reproductor (esquina inferior izquierda).
  devIndicators: false,
  serverExternalPackages: ["@prisma/client"],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
