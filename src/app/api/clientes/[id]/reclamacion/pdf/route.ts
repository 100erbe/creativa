import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { generarPdf } from "@/lib/pdf";
import { BUCKET_RECLAMACIONES, LOTE_VALIDO, rutaAdjunto } from "@/lib/reclamacion";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Prepara uno de los PDF de una reclamación (el estado de cuenta o una factura) y lo deja
 * un momento en el almacenamiento privado, hasta que se crea el borrador de Gmail.
 * Se llama una vez por archivo para que cada petición quede muy por debajo del límite de tiempo.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const clienteId = Number((await params).id);
  const cuerpo = (await request.json().catch(() => null)) as { lote?: unknown; archivo?: unknown } | null;
  const lote = typeof cuerpo?.lote === "string" ? cuerpo.lote : "";
  const archivo = cuerpo?.archivo;
  if (!Number.isInteger(clienteId) || !LOTE_VALIDO.test(lote)) {
    return NextResponse.json({ error: "Petición no válida" }, { status: 400 });
  }

  let ruta: string;
  if (archivo === "estado") {
    ruta = `/admin/clientes/${clienteId}/estado-cuenta`;
  } else if (typeof archivo === "number" && Number.isInteger(archivo)) {
    // Solo facturas o rectificativas emitidas de este cliente.
    const supabase = await createClient();
    const { data: doc } = await supabase
      .from("documentos")
      .select("id")
      .eq("id", archivo)
      .eq("cliente_id", clienteId)
      .in("tipo", ["factura", "rectificativa"])
      .neq("estado", "borrador")
      .maybeSingle();
    if (!doc) return NextResponse.json({ error: "La factura no es de este cliente" }, { status: 400 });
    ruta = `/admin/documentos/${archivo}/imprimir`;
  } else {
    return NextResponse.json({ error: "Archivo no válido" }, { status: 400 });
  }

  const admin = crearClienteAdmin();
  if (!admin) return NextResponse.json({ error: "Falta SUPABASE_SERVICE_ROLE_KEY en el servidor." }, { status: 500 });

  let pdf: Buffer;
  try {
    pdf = await generarPdf(request, ruta);
  } catch (e) {
    console.error("Reclamación · PDF:", e);
    return NextResponse.json({ error: "No se ha podido generar el PDF" }, { status: 502 });
  }

  const { error } = await admin.storage
    .from(BUCKET_RECLAMACIONES)
    .upload(rutaAdjunto(clienteId, lote, archivo), pdf, { contentType: "application/pdf", upsert: true });
  if (error) return NextResponse.json({ error: `No se ha podido guardar el PDF: ${error.message}` }, { status: 500 });

  return NextResponse.json({ ok: true, bytes: pdf.length });
}
