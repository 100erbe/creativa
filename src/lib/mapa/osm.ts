import { urlPublicaApp } from "@/lib/url-publica";

/**
 * Cabeceras para los servicios gratuitos de OpenStreetMap (Nominatim, Overpass). Su política de
 * uso pide identificar la aplicación:
 *  - En el navegador no se puede fijar User-Agent (cabecera prohibida): basta el Referer, que el
 *    navegador manda solo (Referrer-Policy strict-origin-when-cross-origin).
 *  - En el servidor o en una app nativa (sin Referer) se manda un User-Agent propio.
 */
export function cabecerasOSM(): Record<string, string> {
  if (typeof window !== "undefined" && typeof document !== "undefined") return { "Accept-Language": "es" };
  const web = urlPublicaApp();
  return { "User-Agent": `Creativa/1.0${web ? ` (+${web})` : ""}`, "Accept-Language": "es" };
}
