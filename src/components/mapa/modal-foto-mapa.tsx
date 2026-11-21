"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Icono } from "@/components/ui/iconos";
import type { FotoMapa } from "@/lib/mapa/zonas";

function etiquetaOrigenUbicacion(origen?: string | null): string | null {
  switch (origen) {
    case "gps_camara":
      return "GPS al hacer la foto";
    case "exif":
      return "Ubicación de la foto (EXIF)";
    case "gps_al_subir":
      return "Ubicación al subir la foto";
    default:
      return null;
  }
}

function formatoFechaHora(fecha?: string | null): string | null {
  if (!fecha) return null;
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/**
 * Visor ligero que se abre al pulsar uno de los puntitos de foto en el mapa.
 * Se monta en portal sobre cualquier modal de mapa (z-[2200]).
 */
export function ModalFotoMapa({
  foto,
  onCerrar,
}: {
  foto: FotoMapa | null;
  onCerrar: () => void;
}) {
  useEffect(() => {
    if (!foto) return;
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCerrar();
      }
    };
    window.addEventListener("keydown", alTecla, true);
    return () => window.removeEventListener("keydown", alTecla, true);
  }, [foto, onCerrar]);

  if (!foto || typeof document === "undefined") return null;

  const fecha = formatoFechaHora(foto.tomadaEn);
  const origen = etiquetaOrigenUbicacion(foto.origenUbicacion);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={foto.puntoNombre ? `Foto de ${foto.puntoNombre}` : "Foto de la campaña"}
      onClick={onCerrar}
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-fondo-velo-fuerte p-esp4 backdrop-blur-[2px]"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-borde-default bg-fondo-superficie shadow-elevado"
      >
        <div className="flex items-center justify-between gap-esp3 border-b border-borde-default px-esp4 py-esp3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-texto-primario">
              {foto.puntoNombre ?? "Foto realizada"}
            </p>
            {(fecha || origen) && (
              <p className="truncate text-xs text-texto-secundario">
                {[fecha, origen].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar foto"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-icono-default transition-colors hover:bg-fondo-hover hover:text-texto-primario"
          >
            <Icono nombre="cerrar" size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-fondo-lienzo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={foto.url}
            alt={foto.puntoNombre ? `Foto de ${foto.puntoNombre}` : "Foto realizada"}
            className="max-h-[68dvh] w-full object-contain"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-esp2 border-t border-borde-default bg-fondo-superficie px-esp4 py-esp3 text-xs">
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${foto.latitud},${foto.longitud}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-texto-exito hover:underline"
          >
            <Icono nombre="ubicacion" size={13} />
            Ver ubicación en Google Maps
          </a>
          <a
            href={foto.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-texto-marca hover:underline"
          >
            Abrir original
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}
