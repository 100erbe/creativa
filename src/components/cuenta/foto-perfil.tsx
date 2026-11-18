"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { Boton } from "@/components/ui/boton";
import { createClient } from "@/lib/supabase/client";
import { desenvolver } from "@/lib/accion";
import { recortarAvatar } from "@/lib/recortar-avatar";
import { BUCKET_AVATARES, rutaAvatarNueva } from "@/lib/avatar-ruta";
import { guardarMiAvatar, quitarMiAvatar } from "@/lib/cuenta/acciones";

/** Foto de perfil: avatar grande con «Cambiar foto» y «Quitar». La foto se recorta en el navegador. */
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
  const [vista, setVista] = useState<string | null>(url);
  const [cargando, setCargando] = useState<"subir" | "quitar" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const original = e.target.files?.[0];
    e.target.value = "";
    if (!original) return;
    setError(null);
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
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido cambiar la foto.");
    } finally {
      setCargando(null);
    }
  }

  async function quitar() {
    setError(null);
    setCargando("quitar");
    try {
      await desenvolver(quitarMiAvatar());
      setVista(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se ha podido quitar la foto.");
    } finally {
      setCargando(null);
    }
  }

  return (
    <div className="flex flex-col gap-esp3">
      <div className="flex flex-wrap items-center gap-esp4">
        <Avatar url={vista} iniciales={iniciales} tamano="l" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-titulo-panel text-texto-primario">{nombre}</h2>
          {detalle && <div className="mt-esp1">{detalle}</div>}
        </div>
        <div className="flex flex-wrap gap-esp2">
          <input
            ref={entrada}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={elegir}
          />
          <Boton variante="secundario" cargando={cargando === "subir"} onClick={() => entrada.current?.click()}>
            {vista ? "Cambiar foto" : "Añadir foto"}
          </Boton>
          {vista && (
            <Boton variante="fantasma" cargando={cargando === "quitar"} onClick={quitar}>
              Quitar
            </Boton>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-fondo-peligro-sutil px-esp4 py-esp3 text-meta font-medium text-texto-peligro">
          {error}
        </p>
      )}
    </div>
  );
}
