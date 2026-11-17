import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { generarPdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * PDF de un documento: su pantalla de impresión (/imprimir) guardada como PDF.
 * Si se corrige el modelo, este PDF cambia con él.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") return new NextResponse("No autorizado", { status: 401 });

  const { id } = await params;
  const documentoId = Number(id);
  if (!Number.isInteger(documentoId) || documentoId <= 0) return new NextResponse("Documento no válido", { status: 400 });

  // ?pagada=1 → con el sello «PAGADA» (la pantalla de impresión decide si la factura lo admite).
  const sello = request.nextUrl.searchParams.get("pagada") === "1" ? "?pagada=1" : "";
  let pdf: Buffer;
  try {
    pdf = await generarPdf(request, `/admin/documentos/${documentoId}/imprimir${sello}`);
  } catch {
    return new NextResponse("No se ha podido abrir el documento", { status: 502 });
  }

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="documento-${documentoId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
