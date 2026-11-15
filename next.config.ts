import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Chrome sin interfaz para generar PDF: no se empaqueta, se carga tal cual en el servidor.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // Next no detecta solo los binarios de Chrome (se leen del disco en tiempo de ejecución): hay que incluirlos.
  outputFileTracingIncludes: {
    "/api/documentos/[id]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  async headers() {
    return [
      {
        // El service worker no debe cachearse: una versión nueva tiene que llegar a todos los móviles.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
