import Link from "next/link";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { fechaCorta } from "@/lib/formato";
import { ETIQUETA_SOPORTE, etiquetaEstado } from "@/lib/etiquetas";

export type FilaAgenda = {
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

export type FilaEnriquecida = FilaAgenda & {
  diasRetraso: number;
  esCritico: boolean;
  esAtrasado: boolean;
};

export function extraerCiudadYCalle(direccion: string | null): {
  ciudad: string | null;
  calle: string | null;
} {
  const limpia = direccion?.trim();
  if (!limpia) return { ciudad: null, calle: null };
  if (!limpia.includes(",")) {
    return { ciudad: limpia, calle: null };
  }
  const segmentos = limpia
    .split(",")
    .map((segmento) => segmento.trim())
    .filter(Boolean);
  const ultimo = segmentos.pop();
  if (!ultimo) return { ciudad: null, calle: null };

  const ciudad = ultimo.replace(/\b\d{5}\b/g, "").replace(/\s{2,}/g, " ").trim() || null;
  const calle = segmentos.length > 0 ? segmentos.join(", ") : null;

  return { ciudad, calle };
}

export function TarjetaPunto({ p, apagada }: { p: FilaEnriquecida; apagada?: boolean }) {
  const retirada = p.rol_asignacion === "retirador";
  const tieneMapa = p.latitud != null && p.longitud != null;
  const { ciudad, calle } = extraerCiudadYCalle(p.direccion);
  const soporte = p.tipo_soporte ? (ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte) : null;
  const fecha = p.fecha_programada ? fechaCorta(p.fecha_programada) : null;
  const detalle = calle || p.campana;

  const claseBorde = apagada
    ? "border-borde-default bg-fondo-superficie opacity-75"
    : p.esCritico
      ? "border-borde-critico-sutil border-l-4 border-l-borde-critico bg-fondo-critico-sutil/45"
      : p.esAtrasado
        ? "border-borde-peligro-sutil border-l-4 border-l-borde-peligro bg-fondo-superficie"
        : "border-borde-default bg-fondo-superficie";

  return (
    <div
      className={`flex items-center gap-esp2 rounded-lg border ${tieneMapa ? "pr-esp2" : ""} transition-colors duration-rapida ease-suave hover:border-borde-campo ${claseBorde}`}
    >
      <Link
        href={`/app/punto/${p.punto_id}`}
        className="flex min-h-11 min-w-0 flex-1 flex-col justify-center gap-esp1 px-esp3 py-esp2"
      >
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
        {(ciudad || soporte || fecha || detalle) && (
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
            {fecha && (
              <>
                {(ciudad || soporte) && (
                  <span aria-hidden="true" className="shrink-0">
                    ·
                  </span>
                )}
                <span className="shrink-0 tabular-nums">{fecha}</span>
              </>
            )}
            {detalle && (
              <>
                {(ciudad || soporte || fecha) && (
                  <span aria-hidden="true" className="shrink-0">
                    ·
                  </span>
                )}
                <span className="min-w-0 truncate text-texto-terciario">{detalle}</span>
              </>
            )}
          </div>
        )}
      </Link>
      {tieneMapa && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Cómo llegar a ${p.punto}`}
          title="Abrir en Google Maps"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-borde-default bg-fondo-superficie text-icono-marca transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
        >
          <Icono nombre="ubicacion" size={18} />
        </a>
      )}
    </div>
  );
}
