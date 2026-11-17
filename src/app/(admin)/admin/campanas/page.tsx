import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { fechaCorta } from "@/lib/formato";
import { ETIQUETA_ESTADO_CAMPANA as ETIQUETA_ESTADO } from "@/lib/etiquetas";

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
  if (vista === "pipeline") params.set("vista", "pipeline");
  const s = params.toString();
  return s ? `/admin/campanas?${s}` : "/admin/campanas";
}

export default async function PaginaCampanas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; vista?: string }>;
}) {
  const { estado = "", vista: vistaParam } = await searchParams;
  const vista = vistaParam === "pipeline" ? "pipeline" : "lista";
  const supabase = await createClient();

  const resultados = await Promise.all([
    supabase
      .from("campanas")
      .select("id, codigo, nombre, estado, fecha_inicio, fecha_fin")
      .order("fecha_inicio", { ascending: false }),
    supabase.from("v_progreso_campana").select("*"),
  ]);
  lanzarSiError(...resultados);
  const [{ data: campanas }, { data: progreso }] = resultados;

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
    };
  });

  const filas = todas.filter((c) => !estado || c.estado === estado);

  const columnasPipeline = [
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
      <div className="flex flex-wrap items-center gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-texto-primario">Campañas</h1>
          <p className="text-sm text-texto-secundario">Soportes, instalaciones y fotos de cada campaña.</p>
        </div>

        {/* Selector Lista / Pipeline */}
        <div
          role="group"
          aria-label="Modo de visualización"
          className="inline-flex rounded-md border border-borde-default bg-fondo-superficie p-0.5 shadow-xs"
        >
          <Link
            href={urlCampanas({ estado, vista: "lista" })}
            aria-current={vista === "lista" ? "true" : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press md:min-h-8 ${
              vista === "lista"
                ? "bg-fondo-marca-sutil text-texto-marca"
                : "text-texto-secundario hover:text-texto-primario"
            }`}
          >
            <Icono nombre="lista" size={14} />
            Lista
          </Link>
          <Link
            href={urlCampanas({ vista: "pipeline" })}
            aria-current={vista === "pipeline" ? "true" : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press md:min-h-8 ${
              vista === "pipeline"
                ? "bg-fondo-marca-sutil text-texto-marca"
                : "text-texto-secundario hover:text-texto-primario"
            }`}
          >
            <Icono nombre="kanban" size={14} />
            Pipeline
          </Link>
        </div>

        <Link href="/admin/campanas/nueva" className="shrink-0" aria-label="Nueva campaña">
          <Boton>
            <Icono nombre="mas" size={16} />
            <span className="hidden sm:inline">Nueva campaña</span>
          </Boton>
        </Link>
      </div>

      {vista === "lista" && (
        <div className="flex flex-wrap gap-esp2" role="group" aria-label="Filtrar campañas por estado">
          {FILTROS.map((f) => {
            const activo = estado === f.valor;
            return (
              <Link
                key={f.valor}
                href={urlCampanas({ estado: f.valor, vista: "lista" })}
                aria-current={activo ? "true" : undefined}
                className={`inline-flex min-h-10 items-center rounded-completo px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press md:min-h-8 ${
                  activo
                    ? "bg-fondo-marca text-texto-sobre-marca"
                    : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil"
                }`}
              >
                {f.etiqueta}
              </Link>
            );
          })}
        </div>
      )}

      {vista === "pipeline" ? (
        <div className="grid grid-cols-1 gap-esp4 md:grid-cols-2 xl:grid-cols-4">
          {columnasPipeline.map((col) => {
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
                    <Link
                      key={c.id}
                      href={`/admin/campanas/${c.id}`}
                      className={`flex flex-col gap-esp2 rounded-md border bg-fondo-superficie p-esp3 shadow-xs transition-[border-color,transform] duration-rapida ease-salida hover:-translate-y-[1px] ${
                        c.incidencias > 0
                          ? "border-borde-peligro-sutil border-l-4 border-l-borde-peligro hover:border-borde-peligro"
                          : "border-borde-default hover:border-borde-campo"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-texto-primario">{c.nombre}</p>
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

                      <div className="flex items-center gap-esp2">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-completo bg-fondo-sutil">
                          <div
                            className={`h-full rounded-completo transition-[width] duration-lenta ease-salida ${
                              c.incidencias > 0 ? "bg-fondo-peligro" : "bg-fondo-marca"
                            }`}
                            style={{ width: `${c.porcentaje}%` }}
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
                    </Link>
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
        <div className="flex flex-col divide-y divide-borde-default overflow-hidden rounded-lg border border-borde-default bg-fondo-superficie shadow-xs">
          {filas.map((c) => (
            <Link
              key={c.id}
              href={`/admin/campanas/${c.id}`}
              className={`flex flex-col gap-esp2 px-esp4 py-esp4 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil/60 sm:flex-row sm:items-center sm:gap-esp4 md:px-esp6 ${
                c.incidencias > 0 ? "border-l-4 border-l-borde-peligro" : ""
              }`}
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
                      className={`h-full rounded-completo transition-[width] duration-lenta ease-salida ${
                        c.incidencias > 0 ? "bg-fondo-peligro" : "bg-fondo-marca"
                      }`}
                      style={{ width: `${c.porcentaje}%` }}
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
          ))}
          {filas.length === 0 && (
            <p className="px-esp6 py-esp6 text-sm text-texto-terciario">No hay campañas con este filtro.</p>
          )}
        </div>
      )}
    </div>
  );
}
