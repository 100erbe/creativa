"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";
import { confirmarAviso, marcarAvisoLeido } from "@/lib/avisos/acciones";

/** Al abrir el aviso se anota que se ha visto; si es urgente, hay que pulsar "He leído" para dejar de recibir recordatorios. */
export function ConfirmarLectura({
  avisoId,
  urgente,
  cerrado,
  confirmadoEn,
  yaLeido,
}: {
  avisoId: number;
  urgente: boolean;
  cerrado: boolean;
  confirmadoEn: string | null;
  yaLeido: boolean;
}) {
  const router = useRouter();
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [hecho, setHecho] = useState(false);

  useEffect(() => {
    if (!yaLeido) void desenvolver(marcarAvisoLeido(avisoId)).catch(() => {});
  }, [avisoId, yaLeido]);

  if (confirmadoEn || hecho) {
    return (
      <p className="flex items-center gap-esp2 rounded-lg border border-borde-exito bg-fondo-exito-sutil px-esp4 py-esp3 text-sm text-texto-exito">
        <Icono nombre="check" size={16} />
        {confirmadoEn ? `Has confirmado la lectura (${confirmadoEn}).` : "Lectura confirmada. Gracias."}
      </p>
    );
  }

  if (!urgente) {
    return <p className="text-xs text-texto-terciario">Aviso informativo: no hace falta confirmar.</p>;
  }
  if (cerrado) {
    return <p className="text-xs text-texto-terciario">Este aviso ya se ha cerrado: no hace falta confirmar.</p>;
  }

  return (
    <div className="flex flex-col gap-esp2">
      <Boton
        className="min-h-12 w-full text-base"
        cargando={pendiente}
        onClick={() =>
          ejecutar(async () => {
            await desenvolver(confirmarAviso(avisoId));
            setHecho(true);
            router.refresh();
          })
        }
      >
        He leído y entendido
      </Boton>
      <p className="text-center text-xs text-texto-terciario">Mientras no confirmes, recibirás recordatorios.</p>
      {error && <p className="text-center text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
