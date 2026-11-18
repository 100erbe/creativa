import Link from "next/link";
import { CabeceraPaginaBase } from "@/components/ui/cabecera-pagina-base";
import { SubtituloHoy } from "@/components/ui/subtitulo-hoy";
import { TarjetaPunto } from "@/components/empleado/tarjeta-punto";
import { BotonAccionRapida } from "./boton-accion-rapida";
import { cargarDatosAgenda } from "@/lib/agenda-datos";

export const dynamic = "force-dynamic";

function urlAgenda(filtro: string) {
  return filtro ? `/app/agenda?filtro=${encodeURIComponent(filtro)}` : "/app/agenda";
}

export default async function PaginaAgenda({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string }>;
}) {
  const params = await searchParams;
  const filtro =
    params.filtro === "hoy" || params.filtro === "atrasados" || params.filtro === "retirada" ? params.filtro : "";

  const {
    hoy,
    ahora,
    pendientes,
    hechas,
    atrasadasAll,
    criticasAll,
    puntosActivos,
  } = await cargarDatosAgenda();

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

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <CabeceraPaginaBase
        conAvisos={false}
        titulo="Agenda"
        subtitulo={<SubtituloHoy prefijo="Trabajo asignado" fecha={ahora} />}
        acciones={<BotonAccionRapida puntosActivos={puntosActivos} />}
      />

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
              href={urlAgenda(f.valor)}
              aria-current={activo ? "true" : undefined}
              className={`inline-flex min-h-10 items-center rounded-md px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press ${
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
        <p className="rounded-xl border border-dashed border-borde-default bg-fondo-superficie px-esp4 py-esp6 text-center text-sm text-texto-terciario">
          {filtro ? "No hay puntos que coincidan con este filtro." : "No tienes puntos pendientes."}
        </p>
      )}

      {!filtro && hechas.length > 0 && (
        <section className="flex flex-col gap-esp3">
          <h2 className="text-etiqueta uppercase text-texto-secundario">
            Hechos recientemente
          </h2>
          <div className="flex flex-col gap-esp2">
            {hechas.map((p) => (
              <TarjetaPunto key={p.asignacion_id} p={p} apagada />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
