import { existsSync } from "node:fs";
import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
 * Genera el PDF de un documento abriendo su pantalla de impresión (/imprimir) en un Chrome sin interfaz,
 * con la sesión de quien lo pide. Así el PDF es idéntico a lo que se imprime: si se corrige el modelo,
 * este PDF cambia con él.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") return new NextResponse("No autorizado", { status: 401 });

  const { id } = await params;
  const documentoId = Number(id);
  if (!Number.isInteger(documentoId) || documentoId <= 0) return new NextResponse("Documento no válido", { status: 400 });

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

    const respuesta = await pagina.goto(`${origen}/admin/documentos/${documentoId}/imprimir`, {
      waitUntil: "networkidle0",
      timeout: 45_000,
    });
    if (!respuesta?.ok() || new URL(pagina.url()).pathname !== `/admin/documentos/${documentoId}/imprimir`) {
      return new NextResponse("No se ha podido abrir el documento", { status: 502 });
    }
    await pagina.emulateMediaType("print");
    const pdf = await pagina.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="documento-${documentoId}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } finally {
    await navegador.close();
  }
}
