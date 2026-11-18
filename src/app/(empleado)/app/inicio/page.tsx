import Link from "next/link";
import { CabeceraPaginaBase } from "@/components/ui/cabecera-pagina-base";
import { SubtituloHoy } from "@/components/ui/subtitulo-hoy";
import { KpiStripDesplegable } from "@/components/empleado/kpi-strip-desplegable";
import { TarjetaProyeccionAgenda } from "@/components/empleado/tarjeta-proyeccion-agenda";
import { TarjetaPunto } from "@/components/empleado/tarjeta-punto";
import { BotonAccionRapida } from "@/app/(empleado)/app/agenda/boton-accion-rapida";
import { cargarDatosAgenda } from "@/lib/agenda-datos";
import { saludo } from "@/lib/saludo";

export const dynamic = "force-dynamic";

const LIMITE_PROXIMAS = 5;

export default async function PaginaInicioEmpleado() {
  const {
    ahora,
    nombrePila,
    pendientes,
    atrasadasAll,
    criticasAll,
    deHoyAll,
    puntosActivos,
    seriesProyeccion,
  } = await cargarDatosAgenda();

  const proximasInstalaciones = pendientes.slice(0, LIMITE_PROXIMAS);

  return (
    <div className="flex flex-col gap-esp5 px-esp4 pt-esp5">
      <CabeceraPaginaBase
        conAvisos={false}
        titulo={nombrePila ? `${saludo(ahora)}, ${nombrePila}` : "Inicio"}
        subtitulo={<SubtituloHoy prefijo="Resumen de hoy" fecha={ahora} />}
        acciones={<BotonAccionRapida puntosActivos={puntosActivos} />}
      />

      <KpiStripDesplegable
        deHoy={deHoyAll}
        pendientes={pendientes}
        atrasados={atrasadasAll}
        criticosCount={criticasAll.length}
      />

      <TarjetaProyeccionAgenda series={seriesProyeccion} />

      <section aria-labelledby="titulo-proximas-instalaciones" className="flex flex-col gap-esp3">
        <div className="flex items-center justify-between gap-esp2">
          <h2 id="titulo-proximas-instalaciones" className="text-xs font-semibold uppercase tracking-wider text-texto-secundario">
            Próximas instalaciones
          </h2>
          <Link href="/app/agenda" className="text-xs font-medium text-texto-marca hover:underline">
            Ver agenda →
          </Link>
        </div>

        {proximasInstalaciones.length > 0 ? (
          <div className="flex flex-col gap-esp2">
            {proximasInstalaciones.map((p) => (
              <TarjetaPunto key={p.asignacion_id} p={p} />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-borde-default bg-fondo-superficie px-esp4 py-esp6 text-center text-sm text-texto-terciario">
            No tienes instalaciones pendientes.
          </p>
        )}
      </section>
    </div>
  );
}
