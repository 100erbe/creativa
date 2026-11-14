import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { euros, fechaCorta, fechaLarga } from "@/lib/formato";

export const dynamic = "force-dynamic";

export default async function PaginaPanel() {
  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();
  const hoy = new Date();
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    .toISOString()
    .slice(0, 10);

  const [
    { data: facturadoMes },
    { data: pendientesCobro },
    { data: campanasActivas },
    { data: documentosRecientes },
  ] = await Promise.all([
    supabase
      .from("documentos")
      .select("total")
      .in("tipo", ["factura", "rectificativa"])
      .neq("estado", "borrador")
      .gte("fecha", inicioMes),
    supabase
      .from("v_estado_cobro")
      .select("pendiente, estado_cobro")
      .in("estado_cobro", ["pendiente", "parcial", "vencida"]),
    supabase
      .from("v_progreso_campana")
      .select("*")
      .eq("estado_campana", "en_curso"),
    supabase
      .from("documentos")
      .select("id, numero_completo, tipo, estado, total, cliente_razon_social, fecha, clientes(razon_social)")
      .order("fecha", { ascending: false })
      .limit(5),
  ]);

  const totalFacturado = (facturadoMes ?? []).reduce((s, d) => s + Number(d.total), 0);
  const totalPendiente = (pendientesCobro ?? []).reduce((s, d) => s + Number(d.pendiente), 0);
  const facturasVencidas = (pendientesCobro ?? []).filter((d) => d.estado_cobro === "vencida").length;

  return (
    <div className="flex flex-col gap-esp6">
      <div className="flex items-center gap-esp3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-texto-primario">
            Buenos días, {usuario?.nombre}
          </h1>
          <p className="text-sm capitalize text-texto-secundario">
            {fechaLarga(hoy)}
          </p>
        </div>
        <Link href="/admin/documentos/nuevo">
          <Boton>
            <Icono nombre="mas" size={16} />
            Nuevo documento
          </Boton>
        </Link>
      </div>

      <div className="flex gap-esp4">
        <TarjetaKpi
          etiqueta="Facturado este mes"
          valor={euros(totalFacturado)}
        />
        <TarjetaKpi
          etiqueta="Pendiente de cobro"
          valor={euros(totalPendiente)}
          detalle={facturasVencidas > 0 ? `${facturasVencidas} vencidas` : "al día"}
          colorDetalle={facturasVencidas > 0 ? "text-texto-peligro" : "text-texto-exito"}
        />
        <TarjetaKpi
          etiqueta="Campañas activas"
          valor={String(campanasActivas?.length ?? 0)}
          detalle={`${(campanasActivas ?? []).reduce((s, c) => s + Number(c.puntos_totales), 0)} puntos en total`}
        />
        <TarjetaKpi
          etiqueta="Puntos con incidencia"
          valor={String((campanasActivas ?? []).reduce((s, c) => s + Number(c.puntos_con_incidencia), 0))}
          colorDetalle="text-texto-peligro"
        />
      </div>

      <div className="flex flex-1 gap-esp6">
        <div className="flex flex-1 flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
          <div className="flex items-center">
            <h2 className="flex-1 text-base font-semibold text-texto-primario">
              Campañas en curso
            </h2>
            <Link href="/admin/campanas" className="text-sm font-medium text-texto-marca">
              Ver todas
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-fondo-hover">
            {(campanasActivas ?? []).map((c) => {
              const total = Number(c.puntos_totales) || 1;
              const hechos = Number(c.puntos_instalados) + Number(c.puntos_verificados);
              return (
                <Link
                  key={c.campana_id}
                  href={`/admin/campanas/${c.campana_id}`}
                  className="flex items-center gap-esp4 py-esp3"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium text-texto-primario">{c.campana}</p>
                    <p className="text-xs text-texto-terciario">{c.cliente}</p>
                  </div>
                  <div className="flex w-[160px] items-center gap-esp3">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-completo bg-fondo-sutil">
                      <div
                        className="h-full rounded-completo bg-fondo-marca"
                        style={{ width: `${Math.round((hechos / total) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-texto-secundario">{hechos}/{total}</span>
                  </div>
                  <Insignia
                    tono={
                      Number(c.puntos_con_incidencia) > 0
                        ? "peligro"
                        : TONO_POR_ESTADO[c.estado_campana ?? ""] ?? "neutro"
                    }
                  >
                    {Number(c.puntos_con_incidencia) > 0 ? "Incidencia" : "En curso"}
                  </Insignia>
                </Link>
              );
            })}
            {(campanasActivas ?? []).length === 0 && (
              <p className="py-esp4 text-sm text-texto-terciario">
                No hay campañas en curso ahora mismo.
              </p>
            )}
          </div>
        </div>

        <div className="flex w-[420px] flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
          <div className="flex items-center">
            <h2 className="flex-1 text-base font-semibold text-texto-primario">
              Documentos recientes
            </h2>
            <Link href="/admin/documentos" className="text-sm font-medium text-texto-marca">
              Ver todos
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-fondo-hover">
            {(documentosRecientes ?? []).map((d) => (
              <Link
                key={d.id}
                href={`/admin/documentos/${d.id}`}
                className="flex items-center gap-esp3 py-esp3"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-fondo-sutil">
                  <Icono nombre="documentos" size={18} className="text-icono-default" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-texto-primario">
                    {d.numero_completo ?? "Borrador"}
                  </p>
                  <p className="text-xs text-texto-terciario">
                    {d.cliente_razon_social ??
                      (Array.isArray(d.clientes) ? d.clientes[0] : d.clientes)?.razon_social}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="text-sm font-medium text-texto-primario">{euros(Number(d.total))}</p>
                  <Insignia tono={TONO_POR_ESTADO[d.estado] ?? "neutro"}>
                    {d.estado}
                  </Insignia>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
