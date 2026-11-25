"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { confirmar } from "@/components/ui/dialogos";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";
import type { EstadoGasto } from "@/lib/gastos";
import { cambiarEstadoGasto, eliminarGasto } from "@/lib/gastos-acciones";
import { eliminarOptimista } from "@/lib/eliminacion-optimista";

export function ControlesGasto({
  id,
  estado,
  puedeAprobar,
}: {
  id: number;
  estado: EstadoGasto;
  /** Un deducible sin factura adjunta no se puede aprobar. */
  puedeAprobar: boolean;
}) {
  const { router, pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");

  const cambiar = (nuevo: EstadoGasto, texto?: string) => ejecutar(() => desenvolver(cambiarEstadoGasto(id, nuevo, texto)));

  async function borrar() {
    if (!(await confirmar("¿Eliminar este gasto? Se borra también el archivo adjunto."))) return;
    // Optimista: se vuelve al listado (ya sin el gasto) mientras el servidor lo borra.
    router.push("/admin/gastos");
    if (!(await eliminarOptimista(`gasto:${id}`, () => desenvolver(eliminarGasto(id))))) router.refresh();
  }

  return (
    <div className="flex flex-col gap-esp3">
      <div className="flex flex-wrap gap-esp2">
        {(estado === "pendiente" || estado === "rechazado") && (
          <Boton onClick={() => cambiar("aprobado")} cargando={pendiente} disabled={!puedeAprobar}>
            Aprobar
          </Boton>
        )}
        {estado === "pendiente" && (
          <Boton variante="secundario" onClick={() => setRechazando(true)} disabled={pendiente}>
            Rechazar…
          </Boton>
        )}
        {estado === "aprobado" && (
          <>
            <Boton onClick={() => cambiar("reembolsado")} cargando={pendiente}>
              Marcar como reembolsado
            </Boton>
            <Boton variante="secundario" onClick={() => cambiar("pendiente")} disabled={pendiente}>
              Volver a pendiente
            </Boton>
          </>
        )}
        {estado !== "reembolsado" && (
          <Boton variante="peligro" onClick={borrar} disabled={pendiente}>
            Eliminar
          </Boton>
        )}
      </div>
      {!puedeAprobar && estado !== "aprobado" && estado !== "reembolsado" && (
        <p className="text-xs text-texto-aviso">Adjunta la factura (Editar) para poder aprobar este gasto deducible.</p>
      )}
      {rechazando && (
        <div className="flex flex-col gap-esp2 rounded-md border border-borde-default bg-fondo-sutil p-esp3">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo del rechazo (lo verá el empleado)"
            aria-label="Motivo del rechazo"
            className="h-9 w-full rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 text-sm outline-none focus:border-borde-foco"
          />
          <div className="flex gap-esp2">
            <Boton variante="peligro" tamano="s" disabled={!motivo.trim() || pendiente} onClick={() => cambiar("rechazado", motivo)}>
              Confirmar rechazo
            </Boton>
            <Boton variante="secundario" tamano="s" onClick={() => setRechazando(false)}>
              Cancelar
            </Boton>
          </div>
        </div>
      )}
      {error && <p className="text-sm text-texto-peligro">{error}</p>}
    </div>
  );
}
