"use client";

import Link from "next/link";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { MapaPuntos } from "@/components/mapa/mapa-puntos";
import { ALTURA_MAPA_GRANDE } from "@/components/mapa/config-mapa";
import { Icono } from "@/components/ui/iconos";
import { etiquetaEstado } from "@/lib/etiquetas";

type Punto = {
  punto_id: number;
  punto: string;
  latitud: number;
  longitud: number;
  estado_punto: string;
};

export function MapaAgenda({ puntos }: { puntos: Punto[] }) {
  return (
    <div className="flex flex-col gap-esp4 px-esp4 pt-esp5">
      <h1 className="text-xl font-semibold text-texto-primario">Mapa de puntos</h1>
      <MapaPuntos
        puntos={puntos.map((p) => ({
          id: p.punto_id,
          nombre: p.punto,
          latitud: p.latitud,
          longitud: p.longitud,
          estado: p.estado_punto,
        }))}
        altura={ALTURA_MAPA_GRANDE}
      />
      <div className="flex flex-col gap-esp2">
        {puntos.map((p) => (
          <div
            key={p.punto_id}
            className="flex items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie pr-esp3"
          >
            <Link href={`/app/punto/${p.punto_id}`} className="flex min-w-0 flex-1 items-center gap-esp3 px-esp4 py-esp3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-texto-primario">{p.punto}</p>
                <p className="text-xs text-texto-terciario">Abrir ficha del punto</p>
              </div>
              <Insignia tono={TONO_POR_ESTADO[p.estado_punto] ?? "neutro"}>
                {etiquetaEstado(p.estado_punto)}
              </Insignia>
            </Link>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`}
              target="_blank"
              rel="noreferrer"
              aria-label={`Cómo llegar a ${p.punto}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-borde-default text-icono-marca"
            >
              <Icono nombre="ubicacion" size={20} />
            </a>
          </div>
        ))}
        <Link href="/app/agenda" className="text-center text-sm font-medium text-texto-marca">
          Ver lista completa
        </Link>
      </div>
    </div>
  );
}
