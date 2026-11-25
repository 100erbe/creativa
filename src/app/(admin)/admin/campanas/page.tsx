import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { clasesBoton } from "@/components/ui/boton";
import { CabeceraPagina } from "@/components/ui/cabecera-pagina";
import { PestanasEnlace } from "@/components/ui/pestanas";
import { Icono } from "@/components/ui/iconos";
import { fechaCorta } from "@/lib/formato";
import { ETIQUETA_ESTADO_CAMPANA as ETIQUETA_ESTADO } from "@/lib/etiquetas";
import { documentosAsociadosACampanas } from "@/lib/campanas/documentos";
import { BotonEliminarCampana } from "./boton-eliminar-campana";

export const dynamic = "force-dynamic";

const FILTROS = [
  { valor: "", etiqueta: "Todas" },
  { valor: "en_curso", etiqueta: "En curso" },
  { valor: "planificada", etiqueta: "Planificadas" },
  { valor: "finalizada", etiqueta: "Finalizadas" },
];

function urlCampanas({ estado, vista }: { estado?: string; vista?: string }) {
  const params = new URLSearchParams();
  if (estado) params.set("estado", estado);
  if (vista === "tablero") params.set("vista", "tablero");
  const s = params.toString();
  return s ? `/admin/campanas?${s}` : "/admin/campanas";
}

export default async function PaginaCampanas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; vista?: string }>;
}) {
  const { estado = "", vista: vistaParam } = await searchParams;
  const vista = vistaParam === "tablero" || vistaParam === "pipeline" ? "tablero" : "lista";
  const supabase = await createClient();

  const resultados = await Promise.all([
    supabase
      .from("campanas")
      .select("id, codigo, nombre, estado, fecha_inicio, fecha_fin, documento_id")
      .order("fecha_inicio", { ascending: false }),
    supabase.from("v_progreso_campana").select("*"),
  ]);
  lanzarSiError(...resultados);
  const [{ data: campanas }, { data: progreso }] = resultados;
  const documentosPorCampana = await documentosAsociadosACampanas(supabase, campanas ?? []);

  const progresoPorId = new Map((progreso ?? []).map((p) => [p.campana_id, p]));
  const todas = (campanas ?? []).map((c) => {
    const p = progresoPorId.get(c.id);
    const total = Number(p?.puntos_totales ?? 0);
    const hechos =
      Number(p?.puntos_instalados ?? 0) + Number(p?.puntos_verificados ?? 0) + Number(p?.puntos_retirados ?? 0);
    const incidencias = Number(p?.puntos_con_incidencia ?? 0);
    const fotos = Number(p?.fotos_subidas ?? 0);
    return {
      ...c,
      cliente: p?.cliente ?? "—",
      total,
      hechos,
      incidencias,
      fotos,
      porcentaje: total ? Math.round((hechos / total) * 100) : 0,
      documentos: documentosPorCampana.get(c.id) ?? [],
    };
  });

  const filas = todas.filter((c) => !estado || c.estado === estado);

  const columnasTablero = [
    {
      clave: "planificada",
      titulo: "Planificadas",
      punto: "bg-borde-fuerte",
      items: todas.filter((c) => c.estado === "planificada" && c.incidencias === 0),
      alerta: false,
    },
    {
      clave: "en_curso",
      titulo: "En curso",
      punto: "bg-texto-info",
      items: todas.filter((c) => c.estado === "en_curso" && c.incidencias === 0),
      alerta: false,
    },
    {
      clave: "incidencia",
      titulo: "Con incidencia",
      punto: "bg-fondo-peligro",
      items: todas.filter((c) => c.incidencias > 0 && c.estado !== "cancelada"),
      alerta: true,
    },
    {
      clave: "finalizada",
      titulo: "Finalizadas",
      punto: "bg-texto-exito",
      items: todas.filter((c) => c.estado === "finalizada" && c.incidencias === 0),
      alerta: false,
    },
  ];

  return (
    <div className="flex flex-col gap-esp5">
      <CabeceraPagina
        titulo="Campañas"
        subtitulo="Soportes, instalaciones y fotos de cada campaña."
        acciones={
          <>
            <PestanasEnlace
              etiqueta="Modo de visualización"
              className="w-[200px]"
              opciones={[
                {
                  href: urlCampanas({ estado, vista: "lista" }),
                  etiqueta: (
                    <>
                      <Icono nombre="lista" size={14} /> Lista
                    </>
                  ),
                  activa: vista === "lista",
                },
                {
                  href: urlCampanas({ vista: "tablero" }),
                  etiqueta: (
                    <>
                      <Icono nombre="kanban" size={14} /> Tablero
                    </>
                  ),
                  activa: vista === "tablero",
                },
              ]}
            />
            <Link href="/admin/campanas/nueva" className={clasesBoton("primario", "m", "shrink-0")} aria-label="Nueva campaña">
              <Icono nombre="mas" size={16} />
              <span className="hidden sm:inline">Nueva campaña</span>
            </Link>
          </>
        }
      />

      {vista === "lista" && (
        <div className="overflow-x-auto">
          <PestanasEnlace
            etiqueta="Filtrar campañas por estado"
            className="min-w-[480px] max-w-[640px]"
            opciones={FILTROS.map((f) => ({
              href: urlCampanas({ estado: f.valor, vista: "lista" }),
              etiqueta: f.etiqueta,
              activa: estado === f.valor,
            }))}
          />
        </div>
      )}

      {vista === "tablero" ? (
        <div className="grid grid-cols-1 gap-esp4 md:grid-cols-2 xl:grid-cols-4">
          {columnasTablero.map((col) => {
            const totalPuntosCol = col.items.reduce((s, c) => s + c.total, 0);
            return (
              <section
                key={col.clave}
                aria-label={col.titulo}
                className={`flex flex-col gap-esp3 rounded-lg border p-esp3 ${
                  col.alerta && col.items.length > 0
                    ? "border-borde-peligro-sutil bg-fondo-peligro-sutil/40"
                    : "border-borde-default bg-fondo-sutil/60"
                }`}
              >
                <div className="flex items-center justify-between gap-esp2 px-esp1">
                  <div className="flex min-w-0 items-center gap-esp2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${col.punto}`} aria-hidden="true" />
                    <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-texto-primario">
                      {col.titulo}
                    </h2>
                    <span className="tabular-nums rounded-completo bg-fondo-superficie px-1.5 py-0.5 text-micro font-medium text-texto-secundario">
                      {col.items.length}
                    </span>
                  </div>
                  <span className="tabular-nums text-micro text-texto-terciario">{totalPuntosCol} pts</span>
                </div>

                <div className="flex flex-col gap-esp2">
                  {col.items.map((c) => (
                    <div
                      key={c.id}
                      className={`group relative flex flex-col gap-esp2 rounded-md border bg-fondo-superficie p-esp3 transition-[border-color,transform] duration-rapida ease-salida hover:-translate-y-[1px] ${
                        c.incidencias > 0
                          ? "border-borde-peligro-sutil border-l-4 border-l-borde-peligro hover:border-borde-peligro"
                          : "border-borde-default hover:border-borde-campo"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-esp2">
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/admin/campanas/${c.id}`}
                            className="block truncate text-sm font-medium text-texto-primario after:absolute after:inset-0"
                          >
                            {c.nombre}
                          </Link>
                          <p className="truncate text-xs text-texto-secundario">{c.cliente}</p>
                          {(c.codigo || (c.fecha_inicio && c.fecha_fin)) && (
                            <p className="mt-0.5 truncate text-micro text-texto-terciario">
                              {c.codigo ?? ""}
                              {c.codigo && c.fecha_inicio && c.fecha_fin ? " · " : ""}
                              {c.fecha_inicio && c.fecha_fin
                                ? `${fechaCorta(c.fecha_inicio)} – ${fechaCorta(c.fecha_fin)}`
                                : ""}
                            </p>
                          )}
                        </div>
                        <BotonEliminarCampana
                          campanaId={c.id}
                          nombre={c.nombre}
                          contenido={{ puntos: c.total, fotos: c.fotos }}
                          documentos={c.documentos}
                          variante="icono"
                          className="relative z-10 -mr-1 -mt-1 shrink-0"
                        />
                      </div>

                      <div className="flex items-center gap-esp2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-completo bg-fondo-sutil">
                          <div
                            className={`h-full w-full origin-left rounded-completo transition-transform duration-lenta ease-salida motion-reduce:transition-none ${
                              c.incidencias > 0 ? "bg-fondo-peligro" : "bg-fondo-marca"
                            }`}
                            style={{ transform: `scaleX(${c.porcentaje / 100})` }}
                          />
                        </div>
                        <span className="tabular-nums text-micro font-medium text-texto-secundario">
                          {c.hechos}/{c.total}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-esp2 text-micro text-texto-terciario">
                        <span className="tabular-nums">{c.fotos} fotos</span>
                        <Insignia tono={c.incidencias > 0 ? "peligro" : (TONO_POR_ESTADO[c.estado] ?? "neutro")}>
                          {c.incidencias > 0
                            ? `${c.incidencias} incidencia${c.incidencias === 1 ? "" : "s"}`
                            : (ETIQUETA_ESTADO[c.estado] ?? c.estado)}
                        </Insignia>
                      </div>
                    </div>
                  ))}
                  {col.items.length === 0 && (
                    <p className="rounded-md border border-dashed border-borde-default px-esp3 py-esp5 text-center text-xs text-texto-terciario">
                      Sin campañas en esta fase
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-borde-default overflow-hidden rounded-xl border border-borde-default bg-fondo-superficie">
          {filas.map((c) => (
            <div
              key={c.id}
              className={`flex items-center gap-esp2 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil/60 ${
                c.incidencias > 0 ? "border-l-4 border-l-borde-peligro" : ""
              }`}
            >
              <Link
                href={`/admin/campanas/${c.id}`}
                className="flex min-w-0 flex-1 flex-col gap-esp2 py-esp4 pl-esp4 sm:flex-row sm:items-center sm:gap-esp4 md:pl-esp6"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-texto-primario">{c.nombre}</p>
                  <p className="truncate text-xs text-texto-terciario">
                    {c.cliente}
                    {c.codigo ? ` · ${c.codigo}` : ""}
                    {c.fecha_inicio && c.fecha_fin
                      ? ` · ${fechaCorta(c.fecha_inicio)} – ${fechaCorta(c.fecha_fin)}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-esp3 sm:w-auto">
                  <div className="flex flex-1 items-center gap-esp2 sm:w-[150px] sm:flex-none">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-completo bg-fondo-sutil">
                      <div
                        className={`h-full w-full origin-left rounded-completo transition-transform duration-lenta ease-salida motion-reduce:transition-none ${
                          c.incidencias > 0 ? "bg-fondo-peligro" : "bg-fondo-marca"
                        }`}
                        style={{ transform: `scaleX(${c.porcentaje / 100})` }}
                      />
                    </div>
                    <span className="tabular-nums text-xs text-texto-secundario">
                      {c.hechos}/{c.total}
                    </span>
                  </div>
                  <span className="tabular-nums hidden w-[70px] text-xs text-texto-terciario md:block">
                    {c.fotos} fotos
                  </span>
                  <Insignia tono={c.incidencias > 0 ? "peligro" : (TONO_POR_ESTADO[c.estado] ?? "neutro")}>
                    {c.incidencias > 0 ? "Incidencia" : (ETIQUETA_ESTADO[c.estado] ?? c.estado)}
                  </Insignia>
                </div>
              </Link>
              <div className="pr-esp2 md:pr-esp4">
                <BotonEliminarCampana
                  campanaId={c.id}
                  nombre={c.nombre}
                  contenido={{ puntos: c.total, fotos: c.fotos }}
                  documentos={c.documentos}
                  variante="icono"
                />
              </div>
            </div>
          ))}
          {filas.length === 0 && (
            <p className="px-esp6 py-esp6 text-sm text-texto-terciario">No hay campañas con este filtro.</p>
          )}
        </div>
      )}
    </div>
  );
}
