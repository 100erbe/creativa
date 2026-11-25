import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { Icono } from "@/components/ui/iconos";
import { MapaPuntos } from "@/components/mapa/mapa-puntos";
import { SafeMapContainer } from "@/components/shared/SafeMapContainer";
import { ALTURA_MAPA_FICHA } from "@/components/mapa/config-mapa";
import { ETIQUETA_SOPORTE, etiquetaEstado } from "@/lib/etiquetas";
import { fechaMedia } from "@/lib/formato";
import { campanaDe, type FotoFicha, type OtroPuntoContexto, type PuntoFicha } from "./tipos-punto";
import { Tarjeta } from "@/components/ui/tarjeta";

/**
 * Parte de solo lectura de la ficha del punto (Server Component): cabecera, mapa, dirección,
 * incidencia y trabajo a realizar. Lo interactivo (fotos y botones) está en PanelPunto.
 */
export function FichaPunto({
  punto,
  otrosPuntosCampana,
  fotos,
}: {
  punto: PuntoFicha;
  otrosPuntosCampana: OtroPuntoContexto[];
  fotos: FotoFicha[];
}) {
  const campana = campanaDe(punto);

  return (
    <>
      <div className="flex items-start gap-esp3">
        <div className="min-w-0 flex-1">
          <h1 className="text-titulo-panel text-texto-primario">{punto.nombre}</h1>
          <p className="text-sm text-texto-terciario">
            {ETIQUETA_SOPORTE[punto.tipo_soporte] ?? punto.tipo_soporte} · {campana?.nombre}
          </p>
        </div>
        <Insignia tono={TONO_POR_ESTADO[punto.estado] ?? "neutro"}>{etiquetaEstado(punto.estado)}</Insignia>
      </div>

      <SafeMapContainer
        title={punto.nombre}
        coordinates={{ lat: punto.latitud, lng: punto.longitud }}
        address={punto.direccion}
      >
        <MapaPuntos
          puntos={[
            ...otrosPuntosCampana.map((o) => ({
              id: o.id,
              nombre: o.nombre,
              latitud: o.latitud,
              longitud: o.longitud,
              direccion: o.direccion,
              detalle: "Otros puntos de la campaña",
              tipo_ubicacion: o.tipo_ubicacion,
              radio_metros: o.radio_metros,
              geometria: o.geometria,
              inactivo: true,
            })),
            {
              id: punto.id,
              nombre: punto.nombre,
              latitud: punto.latitud,
              longitud: punto.longitud,
              estado: punto.estado,
              direccion: punto.direccion,
              tipo_ubicacion: punto.tipo_ubicacion,
              radio_metros: punto.radio_metros,
              geometria: punto.geometria,
            },
          ]}
          fotos={fotos.flatMap((f) =>
            f.url && f.latitud != null && f.longitud != null
              ? [
                  {
                    id: f.id,
                    puntoId: punto.id,
                    puntoNombre: punto.nombre,
                    url: f.url,
                    latitud: Number(f.latitud),
                    longitud: Number(f.longitud),
                    tomadaEn: f.tomada_en,
                    tipo: f.tipo,
                    origenUbicacion: f.origen_ubicacion,
                  },
                ]
              : [],
          )}
          altura={ALTURA_MAPA_FICHA}
        />
      </SafeMapContainer>

      {punto.direccion && (
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${punto.latitud},${punto.longitud}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-esp2 rounded-xl border border-borde-default bg-fondo-superficie px-esp4 py-esp3 text-sm text-texto-primario"
        >
          <Icono nombre="ubicacion" size={18} className="text-icono-marca" />
          {punto.direccion}
          <span className="ml-auto text-xs text-texto-terciario">Abrir en Google Maps</span>
        </a>
      )}

      {punto.estado === "incidencia" && punto.incidencia && (
        <div className="rounded-md border border-borde-peligro-sutil bg-fondo-peligro-sutil px-esp4 py-esp3">
          <p className="text-xs font-medium text-texto-peligro">INCIDENCIA REPORTADA</p>
          <p className="text-sm text-texto-primario">{punto.incidencia}</p>
        </div>
      )}

      {/* Qué hay que hacer y cuándo: lo que el administrador dejó escrito al crear el punto. */}
      {(punto.notas ||
        punto.piezas != null ||
        punto.fecha_colocacion_prevista ||
        punto.fecha_retirada_prevista ||
        campana?.descripcion) && (
        <Tarjeta disposicion="libre" relleno="ninguno" className="flex flex-col gap-esp2 px-esp4 py-esp3">
          <h2 className="text-etiqueta uppercase text-texto-secundario">Trabajo a realizar</h2>
          {punto.notas && <p className="whitespace-pre-line text-sm text-texto-primario">{punto.notas}</p>}
          {(punto.piezas != null || punto.fecha_colocacion_prevista || punto.fecha_retirada_prevista) && (
            <p className="text-xs text-texto-secundario">
              {[
                punto.piezas != null ? `${punto.piezas} ${punto.piezas === 1 ? "unidad" : "unidades"}` : null,
                punto.fecha_colocacion_prevista ? `Colocar el ${fechaMedia(punto.fecha_colocacion_prevista)}` : null,
                punto.fecha_retirada_prevista ? `Retirar el ${fechaMedia(punto.fecha_retirada_prevista)}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          )}
          {campana?.descripcion && (
            <p className="whitespace-pre-line border-t border-borde-default pt-esp2 text-xs text-texto-terciario">
              Campaña: {campana.descripcion}
            </p>
          )}
        </Tarjeta>
      )}
    </>
  );
}
