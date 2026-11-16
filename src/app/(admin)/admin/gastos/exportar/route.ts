import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { aCsv } from "@/lib/csv";
import { ETIQUETA_ESTADO_GASTO, ETIQUETA_FORMA_PAGO_GASTO, ETIQUETA_TIPO_GASTO } from "@/lib/gastos";

export const dynamic = "force-dynamic";

/** Gastos en CSV (solo admin). ?ejercicio=2026&trimestre=2 */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioActual();
  if (!usuario || usuario.rol !== "admin") return new NextResponse("No autorizado", { status: 403 });

  const params = request.nextUrl.searchParams;
  const ejercicio = Number(params.get("ejercicio"));
  const trimestre = Number(params.get("trimestre"));
  if (!Number.isInteger(ejercicio) || ejercicio < 2000 || ejercicio > 2100) {
    return new NextResponse("Ejercicio no válido", { status: 400 });
  }
  const t = [1, 2, 3, 4].includes(trimestre) ? trimestre : 0;
  const desde = t ? `${ejercicio}-${String((t - 1) * 3 + 1).padStart(2, "0")}-01` : `${ejercicio}-01-01`;
  const hasta = t
    ? new Date(Date.UTC(ejercicio, t * 3, 1)).toISOString().slice(0, 10)
    : `${ejercicio + 1}-01-01`;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gastos")
    .select("*, categorias_gasto(nombre), usuarios!gastos_usuario_id_fkey(nombre, apellidos)")
    .gte("fecha", desde)
    .lt("fecha", hasta)
    .order("fecha")
    .order("id")
    .limit(5000);
  if (error) return new NextResponse(error.message, { status: 500 });

  const csv = aCsv(
    [
      "Código", "Fecha", "Tipo", "Concepto", "Categoría", "Responsable", "Forma de pago", "Total",
      "Tipo IVA", "Base imponible", "Cuota IVA", "Proveedor", "NIF proveedor", "Nº factura",
      "Ticket/Factura", "Estado", "Notas",
    ],
    (data ?? []).map((g) => [
      g.codigo,
      g.fecha,
      ETIQUETA_TIPO_GASTO[g.tipo],
      g.concepto,
      g.categorias_gasto?.nombre,
      g.usuarios ? [g.usuarios.nombre, g.usuarios.apellidos].filter(Boolean).join(" ") : null,
      ETIQUETA_FORMA_PAGO_GASTO[g.forma_pago],
      Number(g.total),
      g.iva_pct == null ? null : Number(g.iva_pct),
      g.base_imponible == null ? null : Number(g.base_imponible),
      g.cuota_iva == null ? null : Number(g.cuota_iva),
      g.proveedor,
      g.nif_proveedor,
      g.numero_factura,
      g.ticket_path ? "Adjunto" : "FALTA",
      ETIQUETA_ESTADO_GASTO[g.estado],
      g.notas,
    ]),
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="gastos-${ejercicio}${t ? `-T${t}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
