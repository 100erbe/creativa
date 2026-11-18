"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";

export type SafeMapCoordinates = {
  lat: number;
  lng: number;
};

/**
 * Permite a la mappa (children) saber si está dentro del modal y cerrarlo,
 * p. ej. tras elegir "Añadir punto aquí". Fuera de SafeMapContainer `cerrar` no hace nada.
 */
const SafeMapContext = createContext<{ enModal: boolean; cerrar: () => void }>({
  enModal: false,
  cerrar: () => {},
});
export const useSafeMap = () => useContext(SafeMapContext);

export interface SafeMapContainerProps {
  children: React.ReactNode;
  /** Titolo mostrato nell'header del Dialog/Drawer mobile */
  title?: string;
  /** Coordinate per il pulsante rapido "Indicazioni" */
  coordinates?: SafeMapCoordinates | null;
  /** Indirizzo testuale alternativo o aggiuntivo per "Indicazioni" */
  address?: string | null;
  /** Testo dell'etichetta di apertura modale (default: "Explorar mapa") */
  exploreLabel?: string;
  /** Testo del pulsante indicazioni (default: "Cómo llegar") */
  directionsLabel?: string;
  /** Classi opzionali sul contenitore esterno */
  className?: string;
}

function buildDirectionsUrl(
  coordinates?: SafeMapCoordinates | null,
  address?: string | null,
): string | null {
  if (
    coordinates &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng)
  ) {
    return `https://www.google.com/maps/dir/?api=1&destination=${coordinates.lat},${coordinates.lng}`;
  }
  const trimmed = address?.trim();
  if (trimmed) {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(trimmed)}`;
  }
  return null;
}

/**
 * Wrapper anti scroll-hijacking per mappe interattive.
 * - Desktop (>= 768px): renderizza la mappa normalmente senza blocchi.
 * - Mobile (< 768px): racchiude la mappa in una card compatta (h-48) con
 *   pointer-events-none di default e margini laterali di sicurezza per lo
 *   scroll con il pollice. L'intera card è un pulsante che apre il Dialog
 *   interattivo quasi a schermo intero (etichetta visiva "Explorar mapa"),
 *   più "Cómo llegar" se sono disponibili coordinate o indirizzo.
 */
export function SafeMapContainer({
  children,
  title = "Mapa",
  coordinates,
  address,
  exploreLabel = "Explorar mapa",
  directionsLabel = "Cómo llegar",
  className,
}: SafeMapContainerProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalOverlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const triggerEl = triggerRef.current;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
      }
    };

    const modalEl = modalOverlayRef.current;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
    };
    modalEl?.addEventListener("wheel", onWheel, { passive: false });

    const media = window.matchMedia("(min-width: 768px)");
    const onBreakpointChange = (e: MediaQueryListEvent) => {
      if (e.matches) {
        setOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    media.addEventListener("change", onBreakpointChange);

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      modalEl?.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      media.removeEventListener("change", onBreakpointChange);
      triggerEl?.focus();
    };
  }, [open]);

  const directionsUrl = buildDirectionsUrl(coordinates, address);
  const inlineCtx = { enModal: false, cerrar: () => setOpen(false) };
  const modalCtx = { enModal: true, cerrar: () => setOpen(false) };

  return (
    <>
      <div
        data-safe-map-container=""
        className={cn(
          "relative mx-2 h-48 overflow-hidden rounded-xl border border-border bg-fondo-sutil md:mx-0 md:h-auto md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:shadow-none",
          className,
        )}
      >
        <div
          data-safe-map-inline-layer=""
          className="h-full w-full select-none touch-pan-y pointer-events-none max-md:isolate max-md:[&>*]:!h-full max-md:[&>*]:!rounded-none max-md:[&>*]:!border-0 max-md:[&_.leaflet-control-zoom]:!hidden max-md:[&_*]:!pointer-events-none max-md:[&_*]:![touch-action:pan-y] md:pointer-events-auto md:h-auto md:select-auto md:touch-auto"
        >
          <SafeMapContext.Provider value={inlineCtx}>{children}</SafeMapContext.Provider>
        </div>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${exploreLabel}: ${title}`}
          className="group absolute inset-0 z-[1100] flex items-end bg-gradient-to-t from-fondo-inverso/60 via-fondo-inverso/10 to-transparent p-esp3 text-left transition-opacity duration-rapida ease-suave md:hidden"
        >
          <span className="inline-flex min-h-11 items-center justify-center gap-esp2 rounded-lg border border-borde-campo bg-fondo-superficie px-esp4 py-esp2 text-xs font-semibold text-texto-primario shadow-md transition-transform duration-rapida ease-salida group-hover:scale-[1.02] group-active:scale-press">
            <Icono nombre="expandir" size={16} className="text-icono-marca" />
            <span>{exploreLabel}</span>
          </span>
        </button>

        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-esp3 right-esp3 z-[1101] inline-flex min-h-11 min-w-11 items-center justify-center gap-esp2 rounded-lg bg-fondo-marca px-esp3 py-esp2 text-xs font-semibold text-texto-sobre-marca shadow-md transition-colors duration-rapida ease-suave hover:bg-fondo-marca-hover active:scale-press md:hidden"
          >
            <Icono nombre="ubicacion" size={16} />
            <span>{directionsLabel}</span>
          </a>
        )}
      </div>

      {mounted &&
        open &&
        createPortal(
          <div
            ref={modalOverlayRef}
            className="fixed inset-0 z-[9999] flex flex-col justify-end overscroll-contain p-2 sm:p-4 md:hidden"
            role="presentation"
          >
            <button
              type="button"
              aria-label="Cerrar mapa"
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="animate-velo-entrar absolute inset-0 cursor-default bg-fondo-velo"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className="animate-hoja-subir relative flex h-[90dvh] w-full flex-col overflow-hidden rounded-xl border border-border bg-fondo-superficie shadow-elevado"
            >
              <div className="relative z-10 flex items-center justify-between gap-esp2 border-b border-border bg-fondo-superficie px-esp4 py-esp3">
                <h2
                  id={titleId}
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-texto-primario"
                >
                  {title}
                </h2>
                <div className="flex shrink-0 items-center gap-esp2">
                  {directionsUrl && (
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 min-w-11 items-center justify-center gap-esp2 rounded-md bg-fondo-marca px-esp3 text-xs font-medium text-texto-sobre-marca transition-colors duration-rapida ease-suave hover:bg-fondo-marca-hover active:scale-press"
                    >
                      <Icono nombre="ubicacion" size={16} />
                      <span>{directionsLabel}</span>
                    </a>
                  )}
                  <button
                    ref={closeRef}
                    type="button"
                    aria-label="Cerrar mapa"
                    onClick={() => setOpen(false)}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 text-xs font-medium text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
                  >
                    <Icono nombre="cerrar" size={18} />
                  </button>
                </div>
              </div>

              <div
                data-safe-map-modal-layer=""
                className="relative isolate flex-1 w-full overflow-hidden pointer-events-auto [&>*]:!h-full [&>*]:!rounded-none [&>*]:!border-0"
              >
                <SafeMapContext.Provider value={modalCtx}>{children}</SafeMapContext.Provider>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
