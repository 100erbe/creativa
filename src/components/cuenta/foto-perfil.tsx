"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Icono } from "@/components/ui/iconos";
import { createClient } from "@/lib/supabase/client";
import { desenvolver } from "@/lib/accion";
import { cn } from "@/lib/cn";
import { recortarAvatar } from "@/lib/recortar-avatar";
import { BUCKET_AVATARES, rutaAvatarNueva } from "@/lib/avatar-ruta";
import { guardarMiAvatar, quitarMiAvatar } from "@/lib/cuenta/acciones";

/**
 * Foto de perfil: el avatar es el propio botón (objetivo táctil de 64 px) con una insignia de
 * cámara abajo a la derecha. Sin foto abre directamente el selector de archivos; con foto abre
 * un menú «Cambiar foto / Quitar foto». La foto se recorta en el navegador antes de subirla.
 */
export function FotoPerfil({
  usuarioId,
  url,
  iniciales,
  nombre,
  detalle,
}: {
  usuarioId: string;
  url: string | null;
  iniciales: string;
  nombre: string;
  detalle?: React.ReactNode;
}) {
  const router = useRouter();
  const entrada = useRef<HTMLInputElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const idMenu = useId();
  const [vista, setVista] = useState<string | null>(url);
  const [menu, setMenu] = useState(false);
  const [cargando, setCargando] = useState<"subir" | "quitar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // Tras subir o quitar, el foco vuelve al avatar cuando ya no está desactivado.
  const devolverFoco = useRef(false);
  useEffect(() => {
    if (cargando === null && devolverFoco.current) {
      devolverFoco.current = false;
      boton.current?.focus();
    }
  }, [cargando]);

  // El menú se cierra con Escape (devolviendo el foco al avatar) y al tocar fuera.
  useEffect(() => {
    if (!menu) return;
    const fuera = (e: PointerEvent) => {
      if (contenedor.current && !contenedor.current.contains(e.target as Node)) setMenu(false);
    };
    const tecla = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        boton.current?.focus();
      }
    };
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [menu]);

  function abrirSelector() {
    setMenu(false);
    entrada.current?.click();
  }

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    e.target.value = "";
    if (!original) return;
    setError(null);
    setAviso(null);
    setCargando("subir");
    try {
      const { archivo, extension } = await recortarAvatar(original);
      const ruta = rutaAvatarNueva(usuarioId, extension);
      const { error: errorSubida } = await createClient()
        .storage.from(BUCKET_AVATARES)
        .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
      if (errorSubida) throw new Error("No se ha podido subir la foto. Inténtalo de nuevo.");
      await desenvolver(guardarMiAvatar(ruta));
      setVista(URL.createObjectURL(archivo));
      setAviso("Foto actualizada");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido cambiar la foto.");
    } finally {
      devolverFoco.current = true;
      setCargando(null);
    }
  }

  async function quitar() {
    setMenu(false);
    setError(null);
    setAviso(null);
    setCargando("quitar");
    try {
      await desenvolver(quitarMiAvatar());
      setVista(null);
      setAviso("Foto quitada");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido quitar la foto.");
    } finally {
      devolverFoco.current = true;
      setCargando(null);
    }
  }

  const ocupado = cargando !== null;

  return (
    <div className="flex flex-col gap-esp3">
      <div className="flex items-center gap-esp4">
        <div ref={contenedor} className="relative shrink-0">
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={elegir}
          />
          <button
            ref={boton}
            type="button"
            disabled={ocupado}
            onClick={() => (vista ? setMenu((m) => !m) : abrirSelector())}
            aria-label={vista ? "Cambiar o quitar la foto de perfil" : "Añadir foto de perfil"}
            aria-haspopup={vista ? "menu" : undefined}
            aria-expanded={vista ? menu : undefined}
            aria-controls={vista && menu ? idMenu : undefined}
            aria-busy={ocupado}
            className="group relative block rounded-lg outline-offset-4 transition-transform duration-rapida ease-salida active:scale-press disabled:cursor-wait"
          >
            <Avatar url={vista} iniciales={iniciales} tamano="l" />
            {/* Velo al pasar el ratón (y mientras sube la foto) */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-0 flex items-center justify-center rounded-lg bg-fondo-velo transition-opacity duration-rapida ease-salida",
                ocupado ? "opacity-100" : "opacity-0 group-hover:opacity-100",
              )}
            >
              {ocupado && (
                <svg viewBox="0 0 16 16" fill="none" className="h-5 w-5 animate-spin text-texto-inverso">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
                  <path d="M14 8a6 6 0 0 0-6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              )}
            </span>
            {/* Insignia de cámara: abajo a la derecha, con anillo blanco para separarla de la foto */}
            <span
              aria-hidden="true"
              className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-completo bg-fondo-marca text-texto-sobre-marca ring-2 ring-fondo-superficie transition-colors duration-rapida ease-suave group-hover:bg-fondo-marca-hover"
            >
              <Icono nombre="camara" size={14} />
            </span>
          </button>

          {menu && vista && (
            <div
              id={idMenu}
              role="menu"
              aria-label="Foto de perfil"
              className="animate-estado-entrar absolute left-0 top-full z-30 mt-esp2 flex w-48 flex-col gap-0.5 rounded-lg border border-borde-default bg-fondo-elevado p-esp1 shadow-elevado"
            >
              <button
                type="button"
                role="menuitem"
                autoFocus
                onClick={abrirSelector}
                className="flex min-h-11 items-center gap-esp3 rounded-md px-esp3 text-left text-cuerpo text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil md:min-h-10"
              >
                <Icono nombre="camara" size={18} className="text-icono-default" />
                Cambiar foto
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={quitar}
                className="flex min-h-11 items-center gap-esp3 rounded-md px-esp3 text-left text-cuerpo text-texto-peligro transition-colors duration-rapida ease-suave hover:bg-fondo-peligro-sutil md:min-h-10"
              >
                <Icono nombre="eliminar" size={18} />
                Quitar foto
              </button>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2 className="truncate text-titulo-panel text-texto-primario">{nombre}</h2>
          {detalle && <div className="mt-esp1">{detalle}</div>}
          <p className="mt-esp1 text-etiqueta text-texto-secundario">
            {vista ? "Pulsa la foto para cambiarla o quitarla." : "Pulsa la imagen para añadir una foto."}
          </p>
        </div>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {aviso ?? ""}
      </p>
      {error && (
        <p role="alert" className="rounded-lg bg-fondo-peligro-sutil px-esp4 py-esp3 text-meta font-medium text-texto-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
