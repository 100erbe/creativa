import "server-only";
import { existsSync } from "node:fs";
import type { NextRequest } from "next/server";
import { urlPublicaApp } from "@/lib/url-publica";

/**
 * Origen al que se abre el Chrome sin interfaz. Nunca se fía a ciegas de la cabecera Host de la
 * petición (se le pasan las cookies de sesión): solo se usa si es la app misma (dominio público,
 * URL de este despliegue de Vercel o localhost); si no, el dominio público.
 */
function origenInterno(request: NextRequest): string {
  const pedido = request.nextUrl.origin;
  const permitidos = new Set(
    [
      urlPublicaApp(),
      process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
      process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : null,
    ].filter((o): o is string => !!o),
  );
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(request.nextUrl.hostname);
  if (permitidos.has(pedido) || (local && process.env.NODE_ENV !== "production")) return pedido;
  const publica = urlPublicaApp();
  if (!publica) throw new Error("No se ha podido preparar el PDF (falta la dirección de la app).");
  return publica;
}

/** Chrome instalado en el ordenador (solo para desarrollo local; en Vercel se usa el empaquetado). */
function chromeLocal() {
  const rutas = [
    process.env.CHROME_PATH,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
  ];
  return rutas.find((r): r is string => !!r && existsSync(r)) ?? null;
}

/**
 * Genera un PDF abriendo una página de impresión de la app (p. ej. /admin/documentos/12/imprimir)
 * en un Chrome sin interfaz, con la sesión de quien lo pide. Así el PDF es idéntico a lo que se
 * imprime. `ruta` es la ruta con su query; si la página redirige a otra (p. ej. al login), falla.
 */
export async function generarPdf(request: NextRequest, ruta: string): Promise<Buffer> {
  const origen = origenInterno(request);
  const puppeteer = (await import("puppeteer-core")).default;
  let ejecutable = chromeLocal();
  let args: string[] = ["--no-sandbox"];
  if (process.env.VERCEL || !ejecutable) {
    const chromium = (await import("@sparticuz/chromium")).default;
    ejecutable = await chromium.executablePath();
    args = chromium.args;
  }

  const navegador = await puppeteer.launch({ executablePath: ejecutable, args, headless: true });
  try {
    const pagina = await navegador.newPage();
    // Solo las cookies de sesión de Supabase (sb-…): es lo único que necesita la página de impresión.
    const cookies = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((c) => c.trim())
      .filter((c) => c.startsWith("sb-") && c.includes("="))
      .map((c) => {
        const i = c.indexOf("=");
        return { name: c.slice(0, i), value: c.slice(i + 1), url: origen };
      });
    if (cookies.length) await pagina.setCookie(...cookies);

    const destino = new URL(ruta, origen);
    const respuesta = await pagina.goto(destino.toString(), { waitUntil: "networkidle0", timeout: 45_000 });
    if (!respuesta?.ok() || new URL(pagina.url()).pathname !== destino.pathname) {
      throw new Error("No se ha podido abrir la página para el PDF");
    }
    await pagina.emulateMediaType("print");
    const pdf = await pagina.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await navegador.close();
  }
}
