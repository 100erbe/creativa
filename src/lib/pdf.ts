import "server-only";
import { existsSync } from "node:fs";
import type { NextRequest } from "next/server";

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
  const origen = request.nextUrl.origin;
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
    const cookies = (request.headers.get("cookie") ?? "")
      .split(";")
      .map((c) => c.trim())
      .filter(Boolean)
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
