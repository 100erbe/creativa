"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icono, type NombreIcono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { atraparFoco } from "@/lib/trampa-foco";

export type SafeMapCoordinates = {
  lat: number;
  lng: number;
};

/**
 * Permite al mapa (children) saber si está dentro del modal y cerrarlo,
 * p. ej. tras elegir "Añadir punto aquí". Fuera de SafeMapContainer `cerrar` no hace nada.
 */
const SafeMapContext = createContext<{ enModal: boolean; cerrar: () => void }>({
  enModal: false,
  cerrar: () => {},
});
export const useSafeMap = () => useContext(SafeMapContext);

export interface SafeMapContainerProps {
  children: React.ReactNode;
  /** Título mostrado en la cabecera del diálogo/cajón móvil */
  title?: string;
  /** Coordenadas para el botón rápido "Cómo llegar" */
  coordinates?: SafeMapCoordinates | null;
  /** Dirección de texto alternativa o adicional para "Cómo llegar" */
  address?: string | null;
  /** Texto de la etiqueta de apertura del modal (por defecto: "Explorar mapa") */
  exploreLabel?: string;
  /** Texto del botón de indicaciones (por defecto: "Cómo llegar") */
  directionsLabel?: string;
  /** Control externo opcional de apertura del modal móvil. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Acción opcional en la cabecera del modal móvil (recibe `cerrar` para cerrarlo sin confirmar descarte). */
  modalAction?: React.ReactNode | ((cerrar: () => void) => React.ReactNode);
  /** Comprobación antes de cerrar el modal con X, Escape o tocando fuera. Si devuelve false no se cierra. */
  onBeforeClose?: () => boolean | Promise<boolean>;
  /** Cuando es true, la vista previa + modal en viewport se usan también en desktop, no solo en móvil. */
  modalSiempre?: boolean;
  /** Cuando es true, el modal ocupa el tamaño máximo del viewport (100vw × 100dvh). */
  tamanoMaximo?: boolean;
  /** Estilo visual del CTA sobre la vista previa del mapa. */
  varianteTrigger?: "superficie" | "primario";
  /** Icono del CTA sobre la vista previa del mapa (por defecto "expandir"). */
  exploreIcon?: NombreIcono;
  /** Clases opcionales en el contenedor externo */
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
 * Contenedor anti scroll-hijacking para mapas interactivos.
 * - Escritorio (>= 768px): renderiza el mapa normalmente sin bloqueos.
 * - Móvil (< 768px): envuelve el mapa en una tarjeta compacta (h-48) con
 *   pointer-events-none por defecto y márgenes laterales de seguridad para el
 *   desplazamiento con el pulgar. Toda la tarjeta es un botón que abre el diálogo
 *   interactivo casi a pantalla completa (etiqueta visual "Explorar mapa"),
 *   además de "Cómo llegar" si hay coordenadas o dirección disponibles.
 */
export function SafeMapContainer({
  children,
  title = "Mapa",
  coordinates,
  address,
  exploreLabel = "Explorar mapa",
  directionsLabel = "Cómo llegar",
  open: openProp,
  onOpenChange,
  modalAction,
  onBeforeClose,
  modalSiempre = false,
  tamanoMaximo = false,
  varianteTrigger = "superficie",
  exploreIcon = "expandir",
  className,
}: SafeMapContainerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = openProp !== undefined ? openProp : internalOpen;
  const setOpen = (next: boolean) => {
    if (openProp === undefined) setInternalOpen(next);
    onOpenChange?.(next);
  };
  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;
  const [mounted, setMounted] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const modalOverlayRef = useRef<HTMLDivElement>(null);
  const onBeforeCloseRef = useRef(onBeforeClose);
  onBeforeCloseRef.current = onBeforeClose;
  const confirmandoCierreRef = useRef(false);

  async function solicitarCierre() {
    if (confirmandoCierreRef.current) return;
    if (!onBeforeCloseRef.current) {
      setOpen(false);
      return;
    }
    confirmandoCierreRef.current = true;
    try {
      const permitir = await onBeforeCloseRef.current();
      if (permitir) setOpen(false);
    } finally {
      confirmandoCierreRef.current = false;
    }
  }
  const solicitarCierreRef = useRef(solicitarCierre);
  solicitarCierreRef.current = solicitarCierre;

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
        if (document.querySelector('[role="alertdialog"], [data-punto-modal]')) return;
        void solicitarCierreRef.current();
      }
    };

    const modalEl = modalOverlayRef.current;
    const onWheel = (e: WheelEvent) => {
      const enMapa = (e.target as HTMLElement | null)?.closest(".leaflet-container");
      if (!enMapa) e.preventDefault();
    };
    modalEl?.addEventListener("wheel", onWheel, { passive: false });

    const media = window.matchMedia("(min-width: 768px)");
    const onBreakpointChange = (e: MediaQueryListEvent) => {
      if (!modalSiempre && e.matches) {
        setOpenRef.current(false);
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
  }, [open, modalSiempre]);

  const directionsUrl = buildDirectionsUrl(coordinates, address);
  const inlineCtx = { enModal: false, cerrar: () => setOpen(false) };
  const modalCtx = { enModal: true, cerrar: () => setOpen(false) };

  return (
    <>
      <div
        data-safe-map-container=""
        className={cn(
          modalSiempre
            ? "relative h-52 overflow-hidden rounded-xl border border-border bg-fondo-sutil max-md:mx-2 max-md:h-48 md:h-64"
            : "relative mx-2 h-48 overflow-hidden rounded-xl border border-border bg-fondo-sutil md:mx-0 md:h-auto md:overflow-visible md:rounded-none md:border-0 md:bg-transparent md:shadow-none",
          className,
        )}
      >
        <div
          data-safe-map-inline-layer=""
          className={cn(
            "h-full w-full select-none touch-pan-y pointer-events-none",
            modalSiempre
              ? "isolate [&>*]:!h-full [&>*]:!rounded-none [&>*]:!border-0 [&_.leaflet-control-zoom]:!hidden [&_*]:!pointer-events-none [&_*]:![touch-action:pan-y]"
              : "max-md:isolate max-md:[&>*]:!h-full max-md:[&>*]:!rounded-none max-md:[&>*]:!border-0 max-md:[&_.leaflet-control-zoom]:!hidden max-md:[&_*]:!pointer-events-none max-md:[&_*]:![touch-action:pan-y] md:pointer-events-auto md:h-auto md:select-auto md:touch-auto",
          )}
        >
          {/* Con el mapa a pantalla completa abierto no se monta el de la tarjeta: un solo contexto WebGL
              a la vez (dos mapas MapLibre/Leaflet a la vez agotan memoria en móviles modestos). */}
          {open ? null : <SafeMapContext.Provider value={inlineCtx}>{children}</SafeMapContext.Provider>}
        </div>

        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`${exploreLabel}: ${title}`}
          className={cn(
            "group absolute inset-0 z-[1100] flex items-end bg-gradient-to-t from-fondo-inverso/60 via-fondo-inverso/10 to-transparent p-esp3 text-left transition-opacity duration-rapida ease-suave",
            !modalSiempre && "md:hidden",
          )}
        >
          <span
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-esp2 rounded-lg px-esp4 py-esp2 text-xs font-semibold shadow-md transition-[transform,background-color] duration-rapida ease-salida group-hover:scale-[1.02] group-active:scale-press",
              varianteTrigger === "primario"
                ? "bg-fondo-marca text-texto-sobre-marca group-hover:bg-fondo-marca-hover"
                : "border border-borde-campo bg-fondo-superficie text-texto-primario",
            )}
          >
            <Icono
              nombre={exploreIcon}
              size={16}
              className={varianteTrigger === "primario" ? "text-icono-sobre-marca" : "text-icono-marca"}
            />
            <span>{exploreLabel}</span>
          </span>
        </button>

        {directionsUrl && (
          <a
            href={directionsUrl}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "absolute bottom-esp3 right-esp3 z-[1101] inline-flex min-h-11 min-w-11 items-center justify-center gap-esp2 rounded-lg bg-fondo-marca px-esp3 py-esp2 text-xs font-semibold text-texto-sobre-marca shadow-md transition-colors duration-rapida ease-suave hover:bg-fondo-marca-hover active:scale-press",
              !modalSiempre && "md:hidden",
            )}
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
            className={cn(
              "fixed inset-0 z-[9999] flex flex-col justify-end overscroll-contain",
              tamanoMaximo ? "p-0" : "p-2 sm:p-4",
              !modalSiempre && "md:hidden",
            )}
            role="presentation"
          >
            <button
              type="button"
              aria-label="Cerrar mapa"
              tabIndex={-1}
              onClick={() => void solicitarCierre()}
              className="animate-velo-entrar absolute inset-0 cursor-default bg-fondo-velo"
            />
            <div ref={atraparFoco}
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              className={cn(
                "animate-hoja-subir relative flex w-full flex-col overflow-hidden bg-fondo-superficie shadow-elevado",
                tamanoMaximo
                  ? "h-[100dvh] rounded-none border-0 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]"
                  : "mb-[env(safe-area-inset-bottom)] h-[90dvh] rounded-xl border border-border",
              )}
            >
              <div className="relative z-10 flex items-center justify-between gap-esp2 border-b border-border bg-fondo-superficie px-esp4 py-esp3">
                <h2
                  id={titleId}
                  className="min-w-0 flex-1 truncate text-sm font-semibold text-texto-primario"
                >
                  {title}
                </h2>
                <div className="flex shrink-0 items-center gap-esp2">
                  {typeof modalAction === "function" ? modalAction(() => setOpen(false)) : modalAction}
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
                    onClick={() => void solicitarCierre()}
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
