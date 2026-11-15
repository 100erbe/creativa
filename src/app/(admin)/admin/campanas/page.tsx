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

export default async function PaginaCampanas({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado = "" } = await searchParams;
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
  const filas = (campanas ?? []).filter((c) => !estado || c.estado === estado);

  return (
    <div className="flex flex-col gap-esp6">
      <div className="flex items-center gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-texto-primario">Campañas</h1>
          <p className="text-sm text-texto-secundario">
            Soportes, instalaciones y fotos de cada campaña.
          </p>
        </div>
        <Link href="/admin/campanas/nueva" className="shrink-0" aria-label="Nueva campaña">
          <Boton>
            <Icono nombre="mas" size={16} />
            <span className="hidden sm:inline">Nueva campaña</span>
          </Boton>
        </Link>
      </div>

      <div className="flex gap-esp2">
        {FILTROS.map((f) => (
          <Link
            key={f.valor}
            href={f.valor ? `/admin/campanas?estado=${f.valor}` : "/admin/campanas"}
            className={
              estado === f.valor
                ? "rounded-completo bg-fondo-marca px-esp3 py-esp1 text-sm font-medium text-texto-sobre-marca"
                : "rounded-completo border border-borde-default bg-fondo-superficie px-esp3 py-esp1 text-sm text-texto-secundario hover:bg-fondo-sutil"
            }
          >
            {f.etiqueta}
          </Link>
        ))}
      </div>

      <div className="flex flex-col divide-y divide-fondo-hover rounded-lg border border-borde-default bg-fondo-superficie px-esp6">
        {filas.map((c) => {
          const p = progresoPorId.get(c.id);
          const total = Number(p?.puntos_totales ?? 0);
          const hechos =
            Number(p?.puntos_instalados ?? 0) + Number(p?.puntos_verificados ?? 0) + Number(p?.puntos_retirados ?? 0);
          const incidencias = Number(p?.puntos_con_incidencia ?? 0);
          return (
            <Link
              key={c.id}
              href={`/admin/campanas/${c.id}`}
              className="flex items-center gap-esp4 py-esp4"
            >
              <div className="flex-1">
                <p className="text-sm font-medium text-texto-primario">{c.nombre}</p>
                <p className="text-xs text-texto-terciario">
                  {p?.cliente ?? "—"}
                  {c.codigo ? ` · ${c.codigo}` : ""}
                  {c.fecha_inicio && c.fecha_fin
                    ? ` · ${fechaCorta(c.fecha_inicio)} – ${fechaCorta(c.fecha_fin)}`
                    : ""}
                </p>
              </div>
              <div className="hidden w-[160px] items-center gap-esp3 sm:flex">
                <div className="h-1.5 flex-1 overflow-hidden rounded-completo bg-fondo-sutil">
                  <div
                    className="h-full rounded-completo bg-fondo-marca"
                    style={{ width: `${total ? Math.round((hechos / total) * 100) : 0}%` }}
                  />
                </div>
                <span className="text-xs text-texto-secundario">
                  {hechos}/{total}
                </span>
              </div>
              <span className="hidden w-[70px] text-xs text-texto-terciario md:block">
                {Number(p?.fotos_subidas ?? 0)} fotos
              </span>
              <Insignia tono={incidencias > 0 ? "peligro" : (TONO_POR_ESTADO[c.estado] ?? "neutro")}>
                {incidencias > 0 ? "Incidencia" : (ETIQUETA_ESTADO[c.estado] ?? c.estado)}
              </Insignia>
            </Link>
          );
        })}
        {filas.length === 0 && (
          <p className="py-esp5 text-sm text-texto-terciario">No hay campañas con este filtro.</p>
        )}
      </div>
    </div>
  );
}
