import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Boton } from "@/components/ui/boton";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { hoyEnEspana } from "@/lib/redondeo";
import type { FilaMargenGlobal } from "@/lib/margen-global";
import { VistaRentabilidad } from "./vista-rentabilidad";

export const dynamic = "force-dynamic";

/**
 * Rentabilidad: margen bruto aproximado de toda la actividad (por mes, cliente y producto).
 * Datos internos (solo admin por RLS): no se exportan a la gestoría ni salen de la app.
 */
export default async function PaginaRentabilidad({
  searchParams,
}: {
  searchParams: Promise<{ anio?: string }>;
}) {
  const { anio: anioPedido } = await searchParams;
  const supabase = await createClient();
  const anioActual = Number(hoyEnEspana().slice(0, 4));

  // Años con documentos (desde el primero hasta el actual).
  const { data: primero } = await supabase
    .from("documentos")
    .select("fecha")
    .in("tipo", ["factura", "rectificativa", "presupuesto"])
    .order("fecha", { ascending: true })
    .limit(1)
    .maybeSingle();
  const anioInicial = primero?.fecha ? Number(primero.fecha.slice(0, 4)) : anioActual;
  const anios = Array.from({ length: Math.max(1, anioActual - anioInicial + 1) }, (_, i) => anioActual - i);
  const anio = anios.includes(Number(anioPedido)) ? Number(anioPedido) : anioActual;

  const resultados = await Promise.all([
    supabase
      .from("v_margen_lineas")
      .select("documento_id, cliente_id, tipo, estado, fecha, producto_id, descripcion, cantidad, unidad, base_neta, coste_total")
      .in("tipo", ["factura", "rectificativa", "presupuesto"])
      .gte("fecha", `${anio}-01-01`)
      .lte("fecha", `${anio}-12-31`)
      .limit(20000),
    supabase.from("documentos").select("id, numero_completo").gte("fecha", `${anio}-01-01`).lte("fecha", `${anio}-12-31`),
    supabase.from("clientes").select("id, razon_social, nombre_comercial"),
    supabase.from("productos").select("id, nombre"),
  ]);
  lanzarSiError(...resultados);
  const [{ data: lineas }, { data: documentos }, { data: clientes }, { data: productos }] = resultados;

  const filas: FilaMargenGlobal[] = (lineas ?? []).flatMap((l) =>
    l.documento_id != null && l.cliente_id != null && l.tipo != null && l.estado != null && l.fecha != null
      ? [
          {
            documento_id: l.documento_id,
            cliente_id: l.cliente_id,
            tipo: l.tipo,
            estado: l.estado,
            fecha: l.fecha,
            producto_id: l.producto_id,
            descripcion: l.descripcion ?? "",
            cantidad: Number(l.cantidad ?? 0),
            unidad: l.unidad ?? "ud",
            base_neta: Number(l.base_neta ?? 0),
            coste_total: l.coste_total == null ? null : Number(l.coste_total),
          },
        ]
      : [],
  );

  return (
    <div className="flex flex-col gap-esp6">
      <CabeceraPagina
        titulo="Rentabilidad"
        subtitulo="Margen bruto aproximado: lo facturado frente al coste interno del catálogo. Solo lo ves tú."
        acciones={
          <form action="/admin/rentabilidad" className="flex items-center gap-esp2">
            <label className="text-etiqueta text-texto-secundario" htmlFor="anio">
              Año
            </label>
            <select
              id="anio"
              name="anio"
              defaultValue={anio}
              className="h-11 rounded-lg border border-borde-campo bg-fondo-superficie px-esp2 text-sm text-texto-primario md:h-[42px]"
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <Boton type="submit" variante="secundario">
              Ver
            </Boton>
          </form>
        }
      />
      <VistaRentabilidad
        anio={anio}
        filas={filas}
        numeros={(documentos ?? []).map((d) => [d.id, d.numero_completo] as [number, string | null])}
        nombresCliente={(clientes ?? []).map(
          (c) => [c.id, c.nombre_comercial?.trim() || c.razon_social] as [number, string],
        )}
        nombresProducto={(productos ?? []).map((p) => [p.id, p.nombre] as [number, string])}
      />
    </div>
  );
}
