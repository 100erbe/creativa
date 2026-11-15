"use client";

import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { confirmar } from "@/components/ui/dialogos";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";
import { cerrarAviso, reenviarAviso } from "@/lib/avisos/acciones";

/** Reenvía ahora el aviso a quien aún no ha confirmado (reinicia sus recordatorios automáticos). */
export function BotonReenviar({ avisoId, cantidad }: { avisoId: number; cantidad: number }) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  return (
    <div className="flex flex-col gap-1">
      <Boton
        variante="secundario"
        cargando={pendiente}
        onClick={() => ejecutar(async () => void (await desenvolver(reenviarAviso(avisoId))))}
      >
        Reenviar ahora a {cantidad} pendiente{cantidad === 1 ? "" : "s"}
      </Boton>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

export function AccionesAviso({ avisoId }: { avisoId: number }) {
  const router = useRouter();
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  return (
    <div className="flex flex-col gap-1">
      <Boton
        variante="fantasma"
        disabled={pendiente}
        onClick={async () => {
          if (!(await confirmar("Se detendrán los recordatorios de este aviso. Úsalo si ya está resuelto, por ejemplo por teléfono.", { aceptar: "Cerrar aviso", peligro: true }))) return;
          ejecutar(async () => {
            await desenvolver(cerrarAviso(avisoId));
            router.refresh();
          });
        }}
      >
        Cerrar aviso
      </Boton>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
