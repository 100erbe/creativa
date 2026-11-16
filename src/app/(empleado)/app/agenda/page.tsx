import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { lanzarSiError } from "@/lib/supabase/consulta";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { diasDesdeVencimiento } from "@/lib/documentos";
import { fechaCorta, fechaLarga } from "@/lib/formato";
import { saludo } from "@/lib/saludo";
import { ETIQUETA_SOPORTE, etiquetaEstado } from "@/lib/etiquetas";

export const dynamic = "force-dynamic";

type Fila = {
  asignacion_id: number | null;
  punto_id: number | null;
  punto: string | null;
  tipo_soporte: string | null;
  campana: string | null;
  estado_punto: string | null;
  estado_asignacion: string | null;
  rol_asignacion: string | null;
  fecha_programada: string | null;
  direccion: string | null;
  latitud: number | null;
  longitud: number | null;
};

type FilaEnriquecida = Fila & {
  diasRetraso: number;
  esCritico: boolean;
  esAtrasado: boolean;
};

/** La fecha de "hoy" en España, en formato AAAA-MM-DD (el servidor puede estar en otra zona horaria). */
function hoyEnEspana() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Madrid" }).format(new Date());
}

function urlAgenda(filtro: string, vista: string) {
  const params = new URLSearchParams();
  if (filtro) params.set("filtro", filtro);
  if (vista === "pipeline") params.set("vista", "pipeline");
  const s = params.toString();
  return s ? `/app/agenda?${s}` : "/app/agenda";
}

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; vista?: string }>;
}) {
  const params = await searchParams;
  const filtro =
    params.filtro === "hoy" || params.filtro === "atrasados" || params.filtro === "retirada" ? params.filtro : "";
  const vista = params.vista === "pipeline" ? "pipeline" : "lista";

  const supabase = await createClient();
  const usuario = await obtenerUsuarioActual();
  const hoy = hoyEnEspana();
  const hoyDate = new Date(`${hoy}T12:00:00Z`);

  const [pendientesRes, hechasRes] = await Promise.all([
    supabase
      .from("v_agenda_empleado")
      .select("*")
      .eq("usuario_id", usuario?.id ?? "")
      .in("estado_asignacion", ["pendiente", "en_curso"])
      .order("fecha_programada", { ascending: true, nullsFirst: false }),
    supabase
      .from("v_agenda_empleado")
      .select("*")
      .eq("usuario_id", usuario?.id ?? "")
      .eq("estado_asignacion", "completada")
      .order("fecha_programada", { ascending: false, nullsFirst: false })
      .limit(10),
  ]);
  lanzarSiError(pendientesRes, hechasRes);

  const enriquecer = (p: Fila, completada = false): FilaEnriquecida => {
    const dias = completada ? 0 : Math.max(0, diasDesdeVencimiento(p.fecha_programada, hoyDate));
    const incidencia = !completada && p.estado_punto === "incidencia";
    const esCritico = !completada && (incidencia || dias >= 7);
    const esAtrasado = !completada && dias >= 1;
    return { ...p, diasRetraso: dias, esCritico, esAtrasado };
  };

  const pendientes = ((pendientesRes.data ?? []) as Fila[]).map((p) => enriquecer(p, false));
  const hechas = ((hechasRes.data ?? []) as Fila[]).map((p) => enriquecer(p, true));

  const atrasadasAll = pendientes.filter((p) => p.esAtrasado || p.estado_punto === "incidencia");
  const criticasAll = pendientes.filter((p) => p.esCritico);
  const deHoyAll = pendientes.filter((p) => p.fecha_programada === hoy && !p.esCritico);

  const filtradas = pendientes.filter((p) => {
    if (filtro === "hoy") return p.fecha_programada === hoy;
    if (filtro === "atrasados") return p.esAtrasado || p.estado_punto === "incidencia";
    if (filtro === "retirada") return p.rol_asignacion === "retirador";
    return true;
  });

  const atrasadas = filtradas.filter((p) => p.esAtrasado || p.estado_punto === "incidencia");
  const deHoy = filtradas.filter((p) => p.fecha_programada === hoy && !p.esAtrasado && p.estado_punto !== "incidencia");
  const proximas = filtradas.filter(
    (p) => p.fecha_programada && p.fecha_programada > hoy && p.estado_punto !== "incidencia",
  );
  const sinFecha = filtradas.filter((p) => !p.fecha_programada && p.estado_punto !== "incidencia");

  const grupos = [
    { titulo: "Atrasados e incidencias", filas: atrasadas, alerta: true },
    { titulo: "Para hoy", filas: deHoy, alerta: false },
    { titulo: "Próximos días", filas: proximas, alerta: false },
    { titulo: "Sin fecha asignada", filas: sinFecha, alerta: false },
  ].filter((g) => g.filas.length > 0);

  const columnasPipeline = [
    {
      clave: "urgentes",
      titulo: "Atrasados / Incidencia",
      punto: criticasAll.length > 0 ? "bg-fondo-critico" : "bg-fondo-peligro",
      items: atrasadasAll,
      critica: criticasAll.length > 0,
    },
    {
      clave: "hoy",
      titulo: "Para hoy",
      punto: "bg-fondo-marca",
      items: deHoyAll,
      critica: false,
    },
    {
      clave: "proximos",
      titulo: "Próximos / Sin fecha",
      punto: "bg-texto-info",
      items: pendientes.filter(
        (p) => !p.esAtrasado && p.estado_punto !== "incidencia" && p.fecha_programada !== hoy,
      ),
      critica: false,
    },
    {
      clave: "completados",
      titulo: "Hechos recientemente",
      punto: "bg-texto-exito",
      items: hechas,
      critica: false,
    },
  ];

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <div className="flex flex-wrap items-start justify-between gap-esp3">
        <div className="min-w-0 flex-1">
          <p className="text-xs capitalize text-texto-secundario">{fechaLarga(new Date())}</p>
          <h1 className="text-xl font-semibold tracking-tight text-texto-primario">
            {saludo()}, {usuario?.nombre}
          </h1>
        </div>

        {/* Selector Lista / Pipeline */}
        <div
          role="group"
          aria-label="Modo de visualización"
          className="inline-flex rounded-md border border-borde-default bg-fondo-superficie p-0.5 shadow-xs"
        >
          <Link
            href={urlAgenda(filtro, "lista")}
            aria-current={vista === "lista" ? "true" : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded px-esp3 text-xs font-medium transition-colors ${
              vista === "lista"
                ? "bg-fondo-marca-sutil text-texto-marca"
                : "text-texto-secundario hover:text-texto-primario"
            }`}
          >
            <Icono nombre="lista" size={14} />
            Lista
          </Link>
          <Link
            href={urlAgenda("", "pipeline")}
            aria-current={vista === "pipeline" ? "true" : undefined}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded px-esp3 text-xs font-medium transition-colors ${
              vista === "pipeline"
                ? "bg-fondo-marca-sutil text-texto-marca"
                : "text-texto-secundario hover:text-texto-primario"
            }`}
          >
            <Icono nombre="kanban" size={14} />
            Pipeline
          </Link>
        </div>
      </div>

      {/* KPI Strip operativo */}
      <div className="grid grid-cols-3 gap-esp2 sm:gap-esp3">
        <Link
          href={urlAgenda("hoy", "lista")}
          className="flex flex-col gap-0.5 rounded-lg border border-borde-default bg-fondo-superficie px-esp3 py-esp3 shadow-xs transition-colors hover:bg-fondo-sutil"
        >
          <span className="text-micro font-medium text-texto-secundario">Para hoy</span>
          <span className="tabular-nums text-xl font-semibold text-texto-primario">{deHoyAll.length}</span>
        </Link>
        <Link
          href={urlAgenda("", "lista")}
          className="flex flex-col gap-0.5 rounded-lg border border-borde-default bg-fondo-superficie px-esp3 py-esp3 shadow-xs transition-colors hover:bg-fondo-sutil"
        >
          <span className="text-micro font-medium text-texto-secundario">Pendientes</span>
          <span className="tabular-nums text-xl font-semibold text-texto-primario">{pendientes.length}</span>
        </Link>
        <Link
          href={urlAgenda("atrasados", "lista")}
          className={
            criticasAll.length > 0
              ? "flex flex-col gap-0.5 rounded-lg border border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/60 px-esp3 py-esp3 shadow-xs"
              : atrasadasAll.length > 0
                ? "flex flex-col gap-0.5 rounded-lg border border-borde-peligro-sutil border-l-4 border-l-borde-peligro bg-fondo-peligro-sutil/60 px-esp3 py-esp3 shadow-xs"
                : "flex flex-col gap-0.5 rounded-lg border border-borde-default bg-fondo-superficie px-esp3 py-esp3 shadow-xs"
          }
        >
          <span
            className={`text-micro font-medium ${
              criticasAll.length > 0
                ? "text-texto-critico"
                : atrasadasAll.length > 0
                  ? "text-texto-peligro"
                  : "text-texto-secundario"
            }`}
          >
            Atrasados
          </span>
          <span
            className={`tabular-nums text-xl font-semibold ${
              criticasAll.length > 0
                ? "text-texto-critico"
                : atrasadasAll.length > 0
                  ? "text-texto-peligro"
                  : "text-texto-primario"
            }`}
          >
            {atrasadasAll.length}
          </span>
        </Link>
      </div>

      {vista === "lista" && (
        <div className="flex flex-wrap gap-esp2" role="group" aria-label="Filtrar agenda">
          {[
            { valor: "", etiqueta: "Todos" },
            { valor: "hoy", etiqueta: "Hoy" },
            { valor: "atrasados", etiqueta: `Atrasados (${atrasadasAll.length})` },
            { valor: "retirada", etiqueta: "Retiradas" },
          ].map((f) => {
            const activo = filtro === f.valor;
            return (
              <Link
                key={f.valor}
                href={urlAgenda(f.valor, "lista")}
                aria-current={activo ? "true" : undefined}
                className={`inline-flex min-h-10 items-center rounded-completo px-esp3 text-xs font-medium transition-colors ${
                  activo
                    ? f.valor === "atrasados" && criticasAll.length > 0
                      ? "bg-fondo-critico text-texto-inverso"
                      : "bg-fondo-marca text-texto-sobre-marca"
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
        <div className="grid grid-cols-1 gap-esp4 md:grid-cols-2">
          {columnasPipeline.map((col) => (
            <section
              key={col.clave}
              aria-label={col.titulo}
              className={`flex flex-col gap-esp3 rounded-lg border p-esp3 ${
                col.critica
                  ? "border-borde-critico-sutil bg-fondo-critico-sutil/35"
                  : "border-borde-default bg-fondo-sutil/60"
              }`}
            >
              <div className="flex items-center justify-between gap-esp2 px-esp1">
                <div className="flex items-center gap-esp2">
                  <span className={`h-2 w-2 shrink-0 rounded-full ${col.punto}`} aria-hidden="true" />
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-texto-primario">{col.titulo}</h2>
                </div>
                <span className="tabular-nums rounded-completo bg-fondo-superficie px-2 py-0.5 text-micro font-medium text-texto-secundario">
                  {col.items.length}
                </span>
              </div>
              <div className="flex flex-col gap-esp2">
                {col.items.map((p) => (
                  <TarjetaPunto key={p.asignacion_id} p={p} apagada={col.clave === "completados"} />
                ))}
                {col.items.length === 0 && (
                  <p className="rounded-md border border-dashed border-borde-default px-esp3 py-esp4 text-center text-xs text-texto-terciario">
                    Sin puntos en esta etapa
                  </p>
                )}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <>
          {grupos.map((g) => (
            <section key={g.titulo} className="flex flex-col gap-esp3">
              <h2
                className={`text-xs font-semibold uppercase tracking-wider ${
                  g.alerta ? "text-texto-critico" : "text-texto-secundario"
                }`}
              >
                {g.titulo} · {g.filas.length}
              </h2>
              <div className="flex flex-col gap-esp2">
                {g.filas.map((p) => (
                  <TarjetaPunto key={p.asignacion_id} p={p} />
                ))}
              </div>
            </section>
          ))}

          {filtradas.length === 0 && (
            <p className="rounded-lg border border-dashed border-borde-default bg-fondo-superficie px-esp4 py-esp6 text-center text-sm text-texto-terciario">
              {filtro ? "No hay puntos que coincidan con este filtro." : "No tienes puntos pendientes."}
            </p>
          )}

          {!filtro && hechas.length > 0 && (
            <section className="flex flex-col gap-esp3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-secundario">
                Hechos recientemente
              </h2>
              <div className="flex flex-col gap-esp2">
                {hechas.map((p) => (
                  <TarjetaPunto key={p.asignacion_id} p={p} apagada />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function TarjetaPunto({ p, apagada }: { p: FilaEnriquecida; apagada?: boolean }) {
  const retirada = p.rol_asignacion === "retirador";
  const claseBorde = apagada
    ? "border-borde-default bg-fondo-superficie opacity-75"
    : p.esCritico
      ? "border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/45"
      : p.esAtrasado
        ? "border-borde-peligro-sutil border-l-4 border-l-borde-peligro bg-fondo-superficie"
        : "border-borde-default bg-fondo-superficie";

  return (
    <div className={`flex items-center gap-esp2 rounded-lg border pr-esp2 shadow-xs transition-colors ${claseBorde}`}>
      <Link href={`/app/punto/${p.punto_id}`} className="flex min-w-0 flex-1 items-center gap-esp3 px-esp3 py-esp3">
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${
            p.esCritico
              ? "bg-fondo-critico text-texto-inverso"
              : retirada
                ? "bg-fondo-info-sutil text-texto-info"
                : "bg-fondo-marca-sutil text-icono-marca"
          }`}
        >
          <Icono nombre={p.esCritico ? "alerta" : "ubicacion"} size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate text-sm font-medium text-texto-primario">{p.punto}</p>
            <span
              className={`rounded px-1.5 py-0.5 text-micro font-medium ${
                retirada ? "bg-fondo-info-sutil text-texto-info" : "bg-fondo-sutil text-texto-secundario"
              }`}
            >
              {retirada ? "Retirar" : "Instalar"}
            </span>
          </div>
          <p className="truncate text-xs text-texto-terciario">
            {ETIQUETA_SOPORTE[p.tipo_soporte ?? ""] ?? p.tipo_soporte} · {p.campana}
            {p.fecha_programada ? ` · ${fechaCorta(p.fecha_programada)}` : ""}
          </p>
          {p.direccion && <p className="truncate text-xs text-texto-terciario">{p.direccion}</p>}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {p.esCritico ? (
            <Insignia tono="critico" solido>
              {p.estado_punto === "incidencia" ? "Incidencia" : `+${p.diasRetraso}d retraso`}
            </Insignia>
          ) : p.esAtrasado ? (
            <Insignia tono="peligro">+{p.diasRetraso}d retraso</Insignia>
          ) : (
            <Insignia tono={TONO_POR_ESTADO[p.estado_punto ?? ""] ?? "neutro"}>
              {etiquetaEstado(p.estado_punto)}
            </Insignia>
          )}
        </div>
      </Link>
      {p.latitud != null && p.longitud != null && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Cómo llegar a ${p.punto}`}
          title="Abrir en Google Maps"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-borde-default bg-fondo-superficie text-icono-marca hover:bg-fondo-sutil"
        >
          <Icono nombre="ubicacion" size={18} />
        </a>
      )}
    </div>
  );
}
