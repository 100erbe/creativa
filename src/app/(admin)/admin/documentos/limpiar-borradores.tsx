"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { desenvolver } from "@/lib/accion";
import { eliminarBorradoresVacios } from "./[id]/acciones";
import { confirmar } from "@/components/ui/dialogos";

/** Aviso con la opción de borrar los borradores sin líneas que deja el asistente al abandonarlo. */
export function LimpiarBorradores({ cantidad }: { cantidad: number }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-esp3 rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp4 py-esp3">
      <Icono nombre="alerta" size={18} className="text-texto-aviso" />
      <p className="min-w-0 flex-1 text-sm text-texto-primario">
        Hay {cantidad} borrador{cantidad === 1 ? "" : "es"} sin ningún artículo (restos de documentos que no se
        llegaron a completar).
      </p>
      <Boton
        tamano="s"
        variante="secundario"
        cargando={pendiente}
        onClick={async () => {
          if (!(await confirmar(`¿Eliminar ${cantidad} borrador${cantidad === 1 ? "" : "es"} vacío${cantidad === 1 ? "" : "s"}? No se puede deshacer.`))) return;
          setError(null);
          iniciar(async () => {
            try {
              await desenvolver(eliminarBorradoresVacios());
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "No se pudieron eliminar.");
            }
          });
        }}
      >
        Eliminar
      </Boton>
      {error && <p className="w-full text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
