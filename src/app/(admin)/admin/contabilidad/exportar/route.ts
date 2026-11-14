import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { aCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

/** Libro registro de facturas en CSV (solo admin). ?ejercicio=2026&trimestre=2 */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const ejercicio = Number(params.get("ejercicio"));
  const trimestre = Number(params.get("trimestre"));
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    return new NextResponse("Ejercicio no válido", { status: 400 });
  }

  const supabase = await createClient();
  let consulta = supabase.from("v_libro_registro").select("*").eq("ejercicio", ejercicio);
  if ([1, 2, 3, 4].includes(trimestre)) consulta = consulta.eq("periodo", `T${trimestre}`);

  const { data, error } = await consulta.order("fecha_expedicion").order("numero").limit(5000);
  if (error) return new NextResponse(error.message, { status: 500 });

  const csv = aCsv(
    [
      "Ejercicio",
      "Periodo",
      "Fecha expedición",
      "Fecha operación",
      "Serie",
      "Número",
      "Tipo",
      "NIF destinatario",
      "Destinatario",
      "Base imponible",
      "Cuota IVA",
      "Retención",
      "Total",
      "Régimen IVA",
      "Motivo exención",
      "Factura rectificada",
      "Cobrado",
      "Pendiente",
      "Estado cobro",
      "Descripción",
    ],
    (data ?? []).map((f) => [
      f.ejercicio,
      f.periodo,
      f.fecha_expedicion,
      f.fecha_operacion,
      f.serie,
      f.numero,
      f.tipo,
      f.nif_destinatario,
      f.destinatario,
      f.base_imponible == null ? null : Number(f.base_imponible),
      f.cuota_iva == null ? null : Number(f.cuota_iva),
      f.importe_retencion == null ? null : Number(f.importe_retencion),
      f.total == null ? null : Number(f.total),
      f.regimen_iva,
      f.motivo_exencion,
      f.factura_rectificada,
      f.cobrado == null ? null : Number(f.cobrado),
      f.pendiente == null ? null : Number(f.pendiente),
      f.estado_cobro,
      f.descripcion,
    ]),
  );

  const nombre = `libro-registro-${ejercicio}${[1, 2, 3, 4].includes(trimestre) ? `-T${trimestre}` : ""}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nombre}"`,
      "Cache-Control": "no-store",
    },
  });
}
