import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Chrome sin interfaz para generar PDF: no se empaqueta, se carga tal cual en el servidor.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
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
