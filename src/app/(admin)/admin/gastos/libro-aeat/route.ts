import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { crearXlsx } from "@/lib/xlsx";
import { filasExpedidas, filasRecibidas, hojasLibroAeat, nifLimpio, type FacturaEmitida } from "@/lib/libro-aeat";
import type { GastoFiscal } from "@/lib/fiscal-gastos";

export const dynamic = "force-dynamic";

/**
 * Libro registro unificado (IVA + IRPF) en el formato electrónico común de la AEAT, en XLSX.
 * ?ejercicio=2026&trimestre=4 → asientos del 1 de enero al último día del trimestre.
 * Nombre del fichero según el diseño: ejercicio + NIF + "T" + nombre o razón social.
 */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") return new NextResponse("No autorizado", { status: 403 });

  const params = request.nextUrl.searchParams;
  const ejercicio = Number(params.get("ejercicio"));
  const trimestre = Number(params.get("trimestre"));
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100 || ![1, 2, 3, 4].includes(trimestre)) {
    return new NextResponse("Ejercicio o trimestre no válido", { status: 400 });
  }
  const desde = `${ejercicio}-01-01`;
  const hasta = new Date(Date.UTC(ejercicio, trimestre * 3, 1)).toISOString().slice(0, 10); // exclusivo

  const supabase = await createClient();
  const [resEmpresa, resFacturas, resGastos] = await Promise.all([
    supabase.from("empresa").select("nif, razon_social, actividad_codigo, actividad_tipo, epigrafe_iae").eq("id", 1).maybeSingle(),
    supabase
      .from("documentos")
      .select(
        "fecha, fecha_operacion, tipo, numero_completo, cliente_documento, cliente_razon_social, cliente_pais, regimen_iva, motivo_exencion, descuento_global_pct, retencion_pct, total, series(codigo), lineas_documento(importe, iva_pct)",
      )
      .in("tipo", ["factura", "rectificativa"])
      .not("estado", "in", "(borrador,anulado)")
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .order("fecha")
      .order("numero")
      .limit(5000),
    supabase
      .from("gastos")
      .select(
        "id, fecha, tipo, estado, total, base_imponible, cuota_iva, iva_pct, pct_deducible_iva, bien_inversion, retencion_pct, importe_retencion, proveedor, nif_proveedor, numero_factura, ticket_path, concepto_aeat",
      )
      .eq("tipo", "deducible")
      .in("estado", ["aprobado", "reembolsado"])
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .order("fecha")
      .order("id")
      .limit(5000),
  ]);
  for (const r of [resEmpresa, resFacturas, resGastos]) {
    if (r.error) return new NextResponse(r.error.message, { status: 500 });
  }
  const empresa = resEmpresa.data;
  if (!empresa) return new NextResponse("Faltan los datos de la empresa", { status: 500 });
  const actividad = { codigo: empresa.actividad_codigo, tipo: empresa.actividad_tipo, epigrafe: empresa.epigrafe_iae };

  const facturas: FacturaEmitida[] = (resFacturas.data ?? []).map((d) => ({
    fecha: d.fecha,
    fecha_operacion: d.fecha_operacion,
    tipo: d.tipo as FacturaEmitida["tipo"],
    serie: d.series?.codigo ?? null,
    numero_completo: d.numero_completo,
    cliente_documento: d.cliente_documento,
    cliente_razon_social: d.cliente_razon_social,
    cliente_pais: d.cliente_pais,
    regimen_iva: d.regimen_iva,
    motivo_exencion: d.motivo_exencion,
    descuento_global_pct: d.descuento_global_pct,
    retencion_pct: d.retencion_pct,
    total: d.total,
    lineas: d.lineas_documento ?? [],
  }));

  const xlsx = crearXlsx(
    hojasLibroAeat(filasExpedidas(facturas, actividad), filasRecibidas((resGastos.data ?? []) as GastoFiscal[], actividad)),
  );

  const nombre = `${ejercicio}${nifLimpio(empresa.nif)}T${empresa.razon_social}.xlsx`;
  const ascii = nombre.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "");
  return new NextResponse(xlsx as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(nombre)}`,
      "Cache-Control": "no-store",
    },
  });
}
