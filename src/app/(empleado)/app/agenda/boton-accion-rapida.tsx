"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { ModalFotoRapida, type CapturaFoto } from "@/components/empleado/modal-foto-rapida";
import type { PuntoActivoAgenda } from "@/lib/distancia";
import { obtenerUbicacion } from "@/lib/ubicacion";
import { cn } from "@/lib/cn";
import { atraparFoco } from "@/lib/trampa-foco";
import { Tarjeta } from "@/components/ui/tarjeta";

const CLAVE_UBICACION = "creativa.incluirUbicacion";

/**
 * Botón `+` de la cabecera de Agenda: abre un modal compacto de creación rápida
 * (Nuevo gasto y Nueva foto instalación con apertura directa de cámara).
 */
export function BotonAccionRapida({ puntosActivos }: { puntosActivos: PuntoActivoAgenda[] }) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [captura, setCaptura] = useState<CapturaFoto | null>(null);
  const [incluirUbicacion, setIncluirUbicacion] = useState(true);

  const inputCamaraRef = useRef<HTMLInputElement>(null);
  const inputGaleriaRef = useRef<HTMLInputElement>(null);
  const promesaUbicacionRef = useRef<ReturnType<typeof obtenerUbicacion> | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(CLAVE_UBICACION) === "no") setIncluirUbicacion(false);
    } catch {
      /* sin almacenamiento */
    }
  }, []);

  function cambiarIncluirUbicacion(valor: boolean) {
    setIncluirUbicacion(valor);
    try {
      localStorage.setItem(CLAVE_UBICACION, valor ? "si" : "no");
    } catch {
      /* ignorar */
    }
  }

  useEffect(() => setAbierto(false), [pathname]);
  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && setAbierto(false);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto]);

  function abrirCamara() {
    if (puntosActivos.length === 0) return;
    promesaUbicacionRef.current = incluirUbicacion ? obtenerUbicacion() : null;
    setAbierto(false);
    inputCamaraRef.current?.click();
  }

  function abrirGaleria() {
    if (puntosActivos.length === 0) return;
    promesaUbicacionRef.current = incluirUbicacion ? obtenerUbicacion() : null;
    inputGaleriaRef.current?.click();
  }

  function onFotoCamara(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setCaptura({
      archivo,
      origenFoto: "camara",
      promesaUbicacion: promesaUbicacionRef.current,
    });
    promesaUbicacionRef.current = null;
  }

  function onFotoGaleria(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    setCaptura({
      archivo,
      origenFoto: "galeria",
      promesaUbicacion: promesaUbicacionRef.current,
    });
    promesaUbicacionRef.current = null;
  }

  const hayPuntos = puntosActivos.length > 0;

  return (
    <>
      <input
        ref={inputCamaraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFotoCamara}
        className="hidden"
      />
      <input
        ref={inputGaleriaRef}
        type="file"
        accept="image/*"
        onChange={onFotoGaleria}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Nueva acción"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        className={clasesBoton("primario", "m", "shrink-0")}
      >
        <Icono nombre="mas" size={16} />
        <span className="hidden sm:inline">Nuevo</span>
      </button>

      {abierto &&
        createPortal(
          <div ref={atraparFoco}
            className="fixed inset-0 z-[3000] flex items-end justify-center p-esp4 sm:items-center"
            role="dialog"
            aria-modal="true"
            aria-label="Nueva acción"
          >
            <button
              type="button"
              aria-label="Cerrar"
              onClick={() => setAbierto(false)}
              className="animate-velo-entrar fixed inset-0 bg-fondo-velo"
            />
            <Tarjeta disposicion="libre" relleno="ninguno" className="animate-hoja-subir sm:animate-modal-entrar relative flex w-full max-w-sm flex-col gap-esp3 p-esp4 shadow-elevado">
              <div className="flex items-center">
                <h2 className="flex-1 text-titulo-panel text-texto-primario">Nueva acción</h2>
                <button
                  type="button"
                  onClick={() => setAbierto(false)}
                  aria-label="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
                >
                  <Icono nombre="cerrar" size={20} />
                </button>
              </div>

              <div className="flex flex-col gap-esp2">
                <Link
                  href="/app/gastos/nuevo"
                  onClick={() => setAbierto(false)}
                  className="group flex min-h-[60px] items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp3 py-esp3 transition-colors duration-rapida ease-suave hover:border-borde-marca hover:bg-fondo-sutil active:scale-press"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-fondo-marca-sutil text-icono-marca">
                    <Icono nombre="gastos" size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-cuerpo font-medium text-texto-primario">Nuevo gasto</span>
                    <span className="block text-etiqueta text-texto-secundario">Registrar ticket o gasto menor</span>
                  </span>
                  <Icono
                    nombre="chevron"
                    size={18}
                    className="text-icono-secundario transition-transform duration-rapida ease-salida group-hover:translate-x-0.5"
                  />
                </Link>

                <button
                  type="button"
                  disabled={!hayPuntos}
                  onClick={abrirCamara}
                  className={cn(
                    "group flex min-h-[60px] w-full items-center gap-esp3 rounded-lg border px-esp3 py-esp3 text-left transition-colors duration-rapida ease-suave",
                    hayPuntos
                      ? "border-borde-default bg-fondo-superficie hover:border-borde-marca hover:bg-fondo-sutil active:scale-press"
                      : "cursor-not-allowed border-dashed border-borde-default bg-fondo-sutil/60 opacity-70",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      hayPuntos ? "bg-fondo-marca-sutil text-icono-marca" : "bg-fondo-superficie text-icono-secundario",
                    )}
                  >
                    <Icono nombre="camara" size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-cuerpo font-medium text-texto-primario">Nueva foto instalación</span>
                    <span className="block text-etiqueta text-texto-secundario">
                      {hayPuntos ? "Hacer foto y asignar a un punto" : "No tienes puntos activos"}
                    </span>
                  </span>
                  {hayPuntos && (
                    <Icono
                      nombre="chevron"
                      size={18}
                      className="text-icono-secundario transition-transform duration-rapida ease-salida group-hover:translate-x-0.5"
                    />
                  )}
                </button>
              </div>
            </Tarjeta>
          </div>,
          document.body,
        )}

      <ModalFotoRapida
        captura={captura}
        puntosActivos={puntosActivos}
        incluirUbicacion={incluirUbicacion}
        onCambiarIncluirUbicacion={cambiarIncluirUbicacion}
        onRepetirCamara={abrirCamara}
        onElegirGaleria={abrirGaleria}
        onCerrar={() => setCaptura(null)}
      />
    </>
  );
}
