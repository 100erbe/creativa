import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad para todas las rutas. La CSP se limita a lo que no puede romper nada
 * (marcos, <base>, <object>, formularios): una CSP de scripts/imágenes/conexiones tendría que
 * listar Supabase, los mapas (MapLibre/Leaflet y sus teselas) y el service worker, y probarse
 * a fondo antes de activarla.
 */
const CABECERAS_SEGURIDAD = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Permite compilar en otra carpeta (NEXT_DIST_DIR=.next-build npx next build) sin pisar
  // la de un `next dev` que esté corriendo en paralelo.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  // Chrome sin interfaz para generar PDF: no se empaqueta, se carga tal cual en el servidor.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // Next no detecta solo los binarios de Chrome (se leen del disco en tiempo de ejecución): hay que incluirlos.
  outputFileTracingIncludes: {
    "/api/documentos/[id]/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
    "/api/clientes/[id]/reclamacion/pdf": ["./node_modules/@sparticuz/chromium/bin/**"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: CABECERAS_SEGURIDAD },
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
