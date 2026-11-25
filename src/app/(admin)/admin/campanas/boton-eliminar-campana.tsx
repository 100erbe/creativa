"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { confirmar } from "@/components/ui/dialogos";
import { eliminarOptimista } from "@/lib/eliminacion-optimista";
import { desenvolver } from "@/lib/accion";
import { cn } from "@/lib/cn";
import { eliminarCampana } from "./[id]/acciones";

/** Construye el mensaje de confirmación destructivo indicando si la campaña tiene documentos asociados. */
export function mensajeConfirmacionEliminarCampana({
  nombre,
  contenido,
  documentos,
}: {
  nombre: string;
  contenido: { puntos: number; fotos: number };
  documentos: string[];
}) {
  const lineas: string[] = [`¿Eliminar la campaña «${nombre}»?`];

  if (documentos.length === 1) {
    lineas.push(
      `Esta campaña está asociada a un documento (${documentos[0]}). Si la eliminas, se desvinculará de ese documento (el documento no se borrará).`,
    );
  } else if (documentos.length > 1) {
    lineas.push(
      `Esta campaña está asociada a ${documentos.length} documentos (${documentos.join(", ")}). Si la eliminas, se desvinculará de esos documentos (los documentos no se borrarán).`,
    );
  }

  const partes = [
    contenido.puntos ? `${contenido.puntos} punto${contenido.puntos === 1 ? "" : "s"}` : "",
    contenido.fotos ? `${contenido.fotos} foto${contenido.fotos === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  if (partes.length > 0) {
    lineas.push(`Se borrarán también ${partes.join(" y ")}.`);
  }

  lineas.push("Esta acción no se puede deshacer.");
  return lineas.join("\n");
}

/** Botón destructivo para eliminar una campaña con confirmación explícita. */
export function BotonEliminarCampana({
  campanaId,
  nombre,
  contenido,
  documentos,
  redirigirA,
  variante = "boton",
  className,
}: {
  campanaId: number;
  nombre: string;
  contenido: { puntos: number; fotos: number };
  documentos: string[];
  redirigirA?: string;
  variante?: "boton" | "icono";
  className?: string;
}) {
  const router = useRouter();
  const [pendiente, setPendiente] = useState(false);

  async function alPulsar(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    const seguro = await confirmar(mensajeConfirmacionEliminarCampana({ nombre, contenido, documentos }), {
      aceptar: "Eliminar campaña",
      peligro: true,
    });
    if (!seguro) return;

    // Optimista: la campaña desaparece de las listas (y se sale de su ficha) al instante;
    // el borrado sigue en el servidor y, si falla, vuelve a aparecer con el aviso.
    setPendiente(true);
    if (redirigirA) router.push(redirigirA);
    const ok = await eliminarOptimista(`campana:${campanaId}`, () => desenvolver(eliminarCampana(campanaId)), {
      mensajeError: "No se pudo eliminar la campaña.",
    });
    setPendiente(false);
    if (!ok && redirigirA) router.refresh();
  }

  if (variante === "icono") {
    return (
      <button
        type="button"
        disabled={pendiente}
        aria-label={`Eliminar campaña ${nombre}`}
        title={`Eliminar campaña ${nombre}`}
        onClick={alPulsar}
        className={cn(
          "flex min-h-11 min-w-11 items-center justify-center rounded-md text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-peligro-sutil hover:text-texto-peligro active:scale-press disabled:opacity-50 md:min-h-8 md:min-w-8",
          className,
        )}
      >
        <Icono nombre="eliminar" size={16} />
      </button>
    );
  }

  return (
    <Boton
      type="button"
      variante="peligro"
      tamano="s"
      disabled={pendiente}
      onClick={alPulsar}
      className={cn("!min-h-10 !h-10 md:!min-h-8 md:!h-8 shrink-0", className)}
    >
      <Icono nombre="eliminar" size={14} />
      Eliminar campaña
    </Boton>
  );
}
