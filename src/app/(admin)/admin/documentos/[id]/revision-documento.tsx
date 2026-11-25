"use client";

import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { marcarRevisado } from "./acciones";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";

/**
 * Pendientes de la importación: motivo de la revisión, si falta el PDF y de dónde salió el documento.
 * «Marcar como revisado» solo quita la marca: no cambia ningún dato del documento.
 */
export function RevisionDocumento({
  documentoId,
  revisar,
  motivo,
  sinPdf,
  origen,
  archivo,
  enlaceDrive,
}: {
  documentoId: number;
  revisar: boolean;
  motivo: string | null;
  sinPdf: boolean;
  origen: string | null;
  archivo: string | null;
  enlaceDrive: string | null;
}) {
  const { router, pendiente, error, ejecutar } = useAccion();
  return (
    <div
      className={
        revisar
          ? "flex flex-col gap-esp2 rounded-lg border border-borde-aviso bg-fondo-aviso-sutil px-esp6 py-esp4"
          : "flex flex-col gap-esp2 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp4"
      }
    >
      <p className="text-sm font-semibold text-texto-primario">{revisar ? "Por revisar" : "Datos de la importación"}</p>
      {revisar && <p className="text-sm text-texto-primario">{motivo || "Marcado para revisar en la importación (sin motivo)."}</p>}
      {!revisar && motivo && <p className="text-xs text-texto-secundario">Revisado. Motivo original: {motivo}</p>}
      <div className="flex flex-wrap gap-x-esp4 gap-y-1 text-xs text-texto-secundario">
        {sinPdf && <span className="font-medium text-texto-aviso">Sin PDF original</span>}
        {origen && <span>Origen: {origen}</span>}
        {archivo && <span className="break-all">Archivo: {archivo}</span>}
        {enlaceDrive && (
          <a href={enlaceDrive} target="_blank" rel="noopener noreferrer" className="font-medium text-texto-marca">
            Abrir PDF original (Drive)
          </a>
        )}
      </div>
      {revisar && (
        <Boton
          tamano="s"
          variante="secundario"
          className="w-fit"
          cargando={pendiente}
          onClick={() =>
            ejecutar(async () => {
              await desenvolver(marcarRevisado(documentoId));
              router.refresh();
            })
          }
        >
          <Icono nombre="check" size={16} />
          Marcar como revisado
        </Boton>
      )}
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
