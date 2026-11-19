import Link from "next/link";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { ETIQUETA_SOPORTE, etiquetaEstado } from "@/lib/etiquetas";
import { cn } from "@/lib/cn";
import { extraerCiudadYCalle, type FilaEnriquecida } from "@/components/empleado/tarjeta-punto";

function formatearDiaMes(fechaIso: string | null): { dia: string; mes: string } | null {
  if (!fechaIso) return null;
  const fecha = new Date(`${fechaIso}T12:00:00Z`);
  if (Number.isNaN(fecha.getTime())) return null;
  const dia = String(fecha.getUTCDate());
  const mes = new Intl.DateTimeFormat("es-ES", { month: "short", timeZone: "UTC" })
    .format(fecha)
    .replace(/\.$/, "")
    .toUpperCase();
  return { dia, mes };
}

/**
 * Tarjeta compacta exclusiva del bloque «Próximas instalaciones» en /app/inicio:
 * bloque de fecha (formato «14 NOV») a la izquierda ocupando la altura de las dos líneas
 * y sin icono de mapa a la derecha.
 */
export function TarjetaProximaInstalacion({ p }: { p: FilaEnriquecida }) {
  const retirada = p.rol_asignacion === "retirador";
  const { ciudad, calle } = extraerCiudadYCalle(p.direccion);
  const soporte = p.tipo_soporte ? (ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte) : null;
  const detalle = calle || p.campana;
  const fecha = formatearDiaMes(p.fecha_programada);

  const claseBorde = p.esCritico
    ? "border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/45"
    : p.esAtrasado
      ? "border-borde-peligro-sutil border-l-4 border-l-borde-peligro bg-fondo-superficie"
      : "border-borde-default bg-fondo-superficie";

  const colorDia = p.esCritico
    ? "text-texto-critico"
    : p.esAtrasado
      ? "text-texto-peligro"
      : "text-texto-primario";

  const bordeDivisor = p.esCritico ? "border-borde-critico-sutil" : "border-borde-default";

  return (
    <Link
      href={`/app/punto/${p.punto_id}`}
      className={cn(
        "flex min-h-[60px] items-center gap-esp3 rounded-lg border px-esp3 py-esp2 transition-colors duration-rapida ease-suave hover:border-borde-campo active:scale-press",
        claseBorde,
      )}
    >
      <div
        aria-label={fecha ? `Programada ${fecha.dia} ${fecha.mes}` : "Sin fecha asignada"}
        className={cn(
          "flex w-11 shrink-0 flex-col items-center justify-center self-stretch border-r pr-esp3",
          bordeDivisor,
        )}
      >
        {fecha ? (
          <>
            <span className={cn("tabular-nums text-importe leading-none", colorDia)}>{fecha.dia}</span>
            <span className="mt-1 text-micro font-semibold uppercase leading-none tracking-wide text-texto-secundario">
              {fecha.mes}
            </span>
          </>
        ) : (
          <span className="text-etiqueta text-texto-terciario">S/F</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-esp1">
        <div className="flex items-center justify-between gap-esp2">
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-texto-primario">{p.punto}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {retirada && <Insignia tono="info">Retirar</Insignia>}
            {p.esCritico ? (
              <Insignia tono="critico" solido>
                {p.estado_punto === "incidencia" ? "Incidencia" : `+${p.diasRetraso}d`}
              </Insignia>
            ) : p.esAtrasado ? (
              <Insignia tono="peligro">+{p.diasRetraso}d</Insignia>
            ) : (
              <Insignia tono={TONO_POR_ESTADO[p.estado_punto ?? ""] ?? "neutro"}>
                {etiquetaEstado(p.estado_punto)}
              </Insignia>
            )}
          </div>
        </div>

        {(ciudad || soporte || detalle) && (
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden text-xs text-texto-terciario">
            {ciudad && <span className="shrink-0 font-semibold text-texto-primario">{ciudad}</span>}
            {soporte && (
              <>
                {ciudad && (
                  <span aria-hidden="true" className="shrink-0">
                    ·
                  </span>
                )}
                <span className="shrink-0">{soporte}</span>
              </>
            )}
            {detalle && (
              <>
                {(ciudad || soporte) && (
                  <span aria-hidden="true" className="shrink-0">
                    ·
                  </span>
                )}
                <span className="min-w-0 truncate text-texto-terciario">{detalle}</span>
              </>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
