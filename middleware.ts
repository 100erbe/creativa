import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Aplica a todas las rutas excepto archivos estáticos e imágenes,
     * para no gastar una llamada a Supabase en cada asset.
     */
    // También fuera: logos (brand/), worker de MapLibre, iconos de la app y cualquier imagen/fuente.
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icons/|brand/|maplibre/|figma/|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|webp|gif|ico|woff2?)$).*)",
  ],
};
