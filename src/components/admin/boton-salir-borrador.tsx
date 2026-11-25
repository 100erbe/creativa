"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boton, clasesBoton } from "@/components/ui/boton";
import { eliminarOptimista } from "@/lib/eliminacion-optimista";
import { eliminarBorrador } from "@/app/(admin)/admin/documentos/[id]/acciones";
import { desenvolver } from "@/lib/accion";
import { atraparFoco } from "@/lib/trampa-foco";

/**
 * Botón «Salir» unificado para todos los pasos del asistente de documentos.
 * - Si aún no hay borrador creado (paso 1 nuevo): vuelve directamente a la lista.
 * - Si ya existe borrador: abre una confirmación para conservarlo o eliminarlo.
 */
export function BotonSalirBorrador({
  documentoId,
  antesDeGuardar,
  destino = "/admin/documentos",
}: {
  documentoId?: number;
  /** Permite guardar cambios locales pendientes (p. ej. Condiciones en paso 4) antes de salir. */
  antesDeGuardar?: (() => Promise<void>) | null;
  destino?: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [accionEnCurso, setAccionEnCurso] = useState<"guardar" | "eliminar" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  useEffect(() => {
    if (!abierto) return;
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pendiente) setAbierto(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [abierto, pendiente]);

  if (!documentoId) {
    return (
      <Link href={destino} className={clasesBoton("secundario", "m")}>
        Salir
      </Link>
    );
  }

  function guardarYSalir() {
    setError(null);
    setAccionEnCurso("guardar");
    iniciar(async () => {
      try {
        if (antesDeGuardar) await antesDeGuardar();
        setAbierto(false);
        router.push(destino);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudieron guardar los cambios.");
      } finally {
        setAccionEnCurso(null);
      }
    });
  }

  function eliminarYSalir() {
    // Optimista: se sale al instante y el borrador ya no aparece en el listado; si el servidor
    // falla, vuelve a aparecer y se avisa.
    const id = documentoId!;
    setError(null);
    setAbierto(false);
    router.push(destino);
    void eliminarOptimista(`documento:${id}`, () => desenvolver(eliminarBorrador(id)), {
      mensajeError: "No se pudo eliminar el borrador.",
    }).then((ok) => {
      if (!ok) router.refresh();
    });
  }

  return (
    <>
      <Boton type="button" variante="secundario" onClick={() => { setError(null); setAbierto(true); }}>
        Salir
      </Boton>

      {abierto && (
        <div
          className="fixed inset-0 z-[10010] flex items-end justify-center p-esp4 sm:items-center"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Cerrar"
            tabIndex={-1}
            disabled={pendiente}
            onClick={() => setAbierto(false)}
            className="animate-velo-entrar absolute inset-0 cursor-default bg-fondo-velo"
          />
          <div ref={atraparFoco}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="salir-borrador-titulo"
            aria-describedby="salir-borrador-detalle"
            className="animate-hoja-subir sm:animate-modal-entrar relative flex w-full max-w-sm flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie p-esp5 shadow-elevado md:p-esp6"
          >
            <div className="flex flex-col gap-esp2">
              <p id="salir-borrador-titulo" className="text-destacado text-texto-primario">
                ¿Salir del borrador?
              </p>
              <p id="salir-borrador-detalle" className="text-cuerpo text-texto-secundario">
                Puedes conservar el borrador para retomarlo más tarde o eliminarlo definitivamente.
              </p>
            </div>

            {error && (
              <p role="alert" className="text-xs text-texto-peligro">
                {error}
              </p>
            )}

            <div className="flex flex-col gap-esp2">
              <Boton
                type="button"
                cargando={pendiente && accionEnCurso === "guardar"}
                disabled={pendiente}
                onClick={guardarYSalir}
              >
                Guardar borrador y salir
              </Boton>
              <Boton
                type="button"
                variante="peligro"
                cargando={pendiente && accionEnCurso === "eliminar"}
                disabled={pendiente}
                onClick={eliminarYSalir}
              >
                Eliminar borrador
              </Boton>
              <Boton
                type="button"
                variante="secundario"
                disabled={pendiente}
                onClick={() => setAbierto(false)}
              >
                Seguir editando
              </Boton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
