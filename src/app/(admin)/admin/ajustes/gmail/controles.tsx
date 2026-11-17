"use client";

import { Boton } from "@/components/ui/boton";
import { confirmar } from "@/components/ui/dialogos";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";
import { desconectarGmail } from "./acciones";

export function BotonDesconectar({ email }: { email: string }) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  return (
    <div className="flex flex-col gap-esp1">
      <Boton
        variante="secundario"
        cargando={pendiente}
        onClick={async () => {
          if (!(await confirmar(`¿Desconectar ${email}? La app dejará de poder crear borradores en esa cuenta.`))) return;
          ejecutar(() => desenvolver(desconectarGmail()));
        }}
      >
        Desconectar
      </Boton>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
