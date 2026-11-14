"use client";

import Link from "next/link";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";

type Punto = {
  punto_id: number;
  punto: string;
  latitud: number;
  longitud: number;
  estado_punto: string;
};

/**
 * Mapa simplificado: hasta que se integre un proveedor real (Google Maps o
 * Mapbox — requiere clave de API y por tanto una decisión aparte), mostramos
 * un enlace directo a Google Maps por punto. El layout ya deja sitio para
 * sustituir este bloque por un mapa interactivo real sin tocar el resto.
 */
export function MapaAgenda({ puntos }: { puntos: Punto[] }) {
  return (
    <div className="flex flex-col gap-esp4 px-esp4 pt-esp5">
      <h1 className="text-xl font-semibold text-texto-primario">Mapa de puntos</h1>
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-borde-fuerte bg-fondo-sutil text-sm text-texto-terciario">
        Mapa interactivo pendiente de conectar (Google Maps / Mapbox)
      </div>
      <div className="flex flex-col gap-esp2">
        {puntos.map((p) => (
          <a
            key={p.punto_id}
            href={`https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3"
          >
            <div className="flex-1">
              <p className="text-sm font-medium text-texto-primario">{p.punto}</p>
              <p className="text-xs text-texto-terciario">Abrir en Google Maps</p>
            </div>
            <Insignia tono={TONO_POR_ESTADO[p.estado_punto] ?? "neutro"}>
              {p.estado_punto}
            </Insignia>
          </a>
        ))}
        <Link href="/app/agenda" className="text-center text-sm font-medium text-texto-marca">
          Ver lista completa
        </Link>
      </div>
    </div>
  );
}
