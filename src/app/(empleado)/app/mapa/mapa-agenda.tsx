"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Insignia, TONO_POR_ESTADO } from "@/components/ui/insignia";
import { MapaPuntos } from "@/components/mapa/mapa-puntos";
import { SafeMapContainer } from "@/components/shared/SafeMapContainer";
import { ALTURA_MAPA_GRANDE } from "@/components/mapa/config-mapa";
import { Icono } from "@/components/ui/iconos";
import { ETIQUETA_SOPORTE, etiquetaEstado } from "@/lib/etiquetas";
import { fechaCorta } from "@/lib/formato";
import type { GeometriaZona, TipoUbicacion } from "@/lib/mapa/zonas";

type Punto = {
  punto_id: number;
  punto: string;
  latitud: number;
  longitud: number;
  estado_punto: string;
  campana?: string | null;
  tipo_soporte?: string | null;
  direccion?: string | null;
  fecha_programada?: string | null;
  rol_asignacion?: string | null;
  tipo_ubicacion?: TipoUbicacion;
  radio_metros?: number | null;
  geometria?: GeometriaZona | null;
};

type FiltroMapa = "todos" | "pendientes" | "incidencias";

export function MapaAgenda({ puntos }: { puntos: Punto[] }) {
  const [filtro, setFiltro] = useState<FiltroMapa>("todos");

  const conteos = useMemo(
    () => ({
      todos: puntos.length,
      pendientes: puntos.filter((p) => p.estado_punto === "pendiente").length,
      incidencias: puntos.filter((p) => p.estado_punto === "incidencia").length,
    }),
    [puntos],
  );

  const visibles = useMemo(() => {
    if (filtro === "pendientes") return puntos.filter((p) => p.estado_punto === "pendiente");
    if (filtro === "incidencias") return puntos.filter((p) => p.estado_punto === "incidencia");
    return puntos;
  }, [puntos, filtro]);

  return (
    <div className="flex flex-col gap-esp4 px-esp4 pt-esp5">
      <div className="flex items-center justify-between gap-esp2">
        <h1 className="text-2xl font-bold text-texto-primario">Mapa de puntos</h1>
        <Link href="/app/agenda" className="text-xs font-medium text-texto-marca">
          Ver agenda →
        </Link>
      </div>

      <div className="flex flex-wrap gap-esp2" role="group" aria-label="Filtrar puntos en el mapa">
        {[
          { clave: "todos" as const, etiqueta: `Todos (${conteos.todos})` },
          { clave: "pendientes" as const, etiqueta: `Pendientes (${conteos.pendientes})` },
          { clave: "incidencias" as const, etiqueta: `Incidencias (${conteos.incidencias})` },
        ].map((f) => {
          const activo = filtro === f.clave;
          return (
            <button
              key={f.clave}
              type="button"
              onClick={() => setFiltro(f.clave)}
              aria-pressed={activo}
              className={`tabular-nums inline-flex min-h-10 items-center rounded-md px-esp3 text-xs font-medium transition-colors ${
                activo
                  ? f.clave === "incidencias" && conteos.incidencias > 0
                    ? "bg-fondo-critico text-texto-inverso"
                    : "bg-fondo-marca text-texto-sobre-marca"
                  : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil"
              }`}
            >
              {f.etiqueta}
            </button>
          );
        })}
      </div>

      <SafeMapContainer
        title="Mapa de puntos"
        coordinates={
          visibles[0]
            ? { lat: visibles[0].latitud, lng: visibles[0].longitud }
            : null
        }
        address={visibles[0]?.direccion ?? null}
      >
        <MapaPuntos
          puntos={visibles.map((p) => ({
            id: p.punto_id,
            nombre: p.punto,
            latitud: p.latitud,
            longitud: p.longitud,
            estado: p.estado_punto,
            direccion: p.direccion,
            tipo_ubicacion: p.tipo_ubicacion,
            radio_metros: p.radio_metros,
            geometria: p.geometria,
          }))}
          altura={ALTURA_MAPA_GRANDE}
        />
      </SafeMapContainer>

      <div className="flex flex-col gap-esp2">
        {visibles.map((p) => {
          const incidencia = p.estado_punto === "incidencia";
          const retirada = p.rol_asignacion === "retirador";
          return (
            <div
              key={p.punto_id}
              className={`flex items-center gap-esp2 rounded-xl border bg-fondo-superficie pr-esp2 ${
                incidencia ? "border-borde-critico-sutil border-l-4 border-l-borde-critico" : "border-borde-default"
              }`}
            >
              <Link href={`/app/punto/${p.punto_id}`} className="flex min-w-0 flex-1 items-center gap-esp3 px-esp3 py-esp3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="truncate text-sm font-medium text-texto-primario">{p.punto}</p>
                    {retirada && (
                      <span className="rounded bg-fondo-info-sutil px-1.5 py-0.5 text-micro font-medium text-texto-info">
                        Retirar
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-texto-terciario">
                    {[
                      p.tipo_soporte ? (ETIQUETA_SOPORTE[p.tipo_soporte] ?? p.tipo_soporte) : null,
                      p.campana ?? null,
                      p.fecha_programada ? fechaCorta(p.fecha_programada) : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Abrir ficha del punto"}
                  </p>
                  {p.direccion && <p className="truncate text-xs text-texto-terciario">{p.direccion}</p>}
                </div>
                <Insignia tono={incidencia ? "critico" : (TONO_POR_ESTADO[p.estado_punto] ?? "neutro")} solido={incidencia}>
                  {etiquetaEstado(p.estado_punto)}
                </Insignia>
              </Link>
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${p.latitud},${p.longitud}`}
                target="_blank"
                rel="noreferrer"
                aria-label={`Cómo llegar a ${p.punto}`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-borde-default text-icono-marca hover:bg-fondo-sutil"
              >
                <Icono nombre="ubicacion" size={20} />
              </a>
            </div>
          );
        })}
        {visibles.length === 0 && (
          <p className="rounded-xl border border-dashed border-borde-default bg-fondo-superficie px-esp4 py-esp5 text-center text-sm text-texto-terciario">
            No hay puntos en esta selección.
          </p>
        )}
      </div>
    </div>
  );
}
