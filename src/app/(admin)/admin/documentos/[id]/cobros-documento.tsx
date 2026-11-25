"use client";

import { useState } from "react";
import Link from "next/link";
import { Boton, clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { METODOS_COBRO, type MetodoCobro } from "@/lib/documentos";
import { registrarCobro, eliminarCobro, compensarRectificativa } from "./acciones";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";
import { useAccion } from "@/lib/use-accion";
import { BotonCompartir } from "./boton-compartir";
import { hoy } from "./condiciones-documento";

/** Formulario para anotar un cobro y lista de cobros ya registrados. */
export function Cobros({
  documentoId,
  pendiente: importePendiente,
  cobros,
  compartir,
  esRectificativa = false,
  compensables = [],
}: {
  documentoId: number;
  /** Negativo en una rectificativa: lo que queda por devolver (o compensar) al cliente. */
  pendiente: number;
  esRectificativa?: boolean;
  /** Factura ↔ rectificativa con importe abierto en sentido contrario: se pueden compensar. */
  compensables?: { rectificativaId: number; facturaId: number; numero: string; importe: number }[];
  cobros: { id: number; fecha: string; importe: number; metodo: string; referencia: string | null }[];
  /** Datos para compartir el PDF (con sello «PAGADA» cuando está cobrada). */
  compartir?: { archivo: string; titulo: string; texto: string };
}) {
  const { router, pendiente, error, ejecutar } = useAccion();
  const abierto = Math.abs(importePendiente);
  // En una rectificativa lo pendiente es a favor del cliente: se registra una devolución.
  const esDevolucion = importePendiente < -0.005;
  const [importe, setImporte] = useState(abierto > 0.005 ? abierto.toFixed(2) : "");
  const [fecha, setFecha] = useState(hoy());
  const [metodo, setMetodo] = useState<MetodoCobro>("transferencia");
  const [referencia, setReferencia] = useState("");

  const euros = (v: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

  return (
    <div className="flex flex-col gap-esp3">
      {cobros.length > 0 && (
        <div className="flex flex-col divide-y divide-borde-default">
          {cobros.map((c) => (
            <div key={c.id} className="flex items-center gap-esp2 py-esp2 text-sm">
              <div className="flex-1">
                <p className="font-medium text-texto-primario">{euros(c.importe)}</p>
                <p className="text-xs text-texto-terciario">
                  {new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" }).format(
                    new Date(c.fecha),
                  )}{" "}
                  · {METODOS_COBRO.find((m) => m.valor === c.metodo)?.etiqueta ?? c.metodo}
                  {c.referencia ? ` · ${c.referencia}` : ""}
                </p>
              </div>
              <button
                aria-label="Eliminar cobro"
                disabled={pendiente}
                onClick={async () => {
                  if (!(await confirmar("¿Eliminar este cobro?"))) return;
                  ejecutar(async () => {
                    await desenvolver(eliminarCobro(documentoId, c.id));
                    router.refresh();
                  });
                }}
                className="text-icono-secundario hover:text-texto-peligro disabled:opacity-50"
              >
                <Icono nombre="eliminar" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {compensables.map((c) => (
        <div key={c.rectificativaId + "-" + c.facturaId} className="flex flex-col gap-1 rounded-md bg-fondo-sutil px-esp3 py-esp3">
          <p className="text-xs text-texto-secundario">
            {esRectificativa
              ? `La factura ${c.numero} sigue pendiente de cobro. Si el abono se descuenta de ella, compénsalos:`
              : `La rectificativa ${c.numero} tiene importe a favor del cliente. Si se descuenta de esta factura, compénsalas:`}
          </p>
          <Boton
            tamano="s"
            variante="secundario"
            cargando={pendiente}
            onClick={async () => {
              if (
                !(await confirmar(
                  `Se anotará una compensación de ${euros(c.importe)} en las dos facturas (a la misma fecha). ¿Continuar?`,
                ))
              )
                return;
              ejecutar(async () => {
                await desenvolver(compensarRectificativa(c.rectificativaId, c.facturaId, fecha));
                router.refresh();
              });
            }}
          >
            Compensar {euros(c.importe)} con {c.numero}
          </Boton>
        </div>
      ))}

      {abierto > 0.005 ? (
        <form
          className="flex flex-col gap-esp2"
          onSubmit={(e) => {
            e.preventDefault();
            ejecutar(async () => {
              await desenvolver(registrarCobro(documentoId, {
                importe: Number(importe.replace(",", ".")),
                fecha,
                metodo,
                referencia,
              }));
              setReferencia("");
              router.refresh();
            });
          }}
        >
          <div className="flex gap-esp2">
            <input
              value={importe}
              onChange={(e) => setImporte(e.target.value)}
              inputMode="decimal"
              aria-label={esDevolucion ? "Importe devuelto" : "Importe cobrado"}
              className="h-11 md:h-9 w-[110px] rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario"
            />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha del cobro"
              className="h-11 md:h-9 flex-1 rounded-lg border border-borde-campo bg-fondo-superficie px-esp2 text-base md:text-sm text-texto-primario"
            />
          </div>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as MetodoCobro)}
            aria-label="Método de cobro"
            className="h-11 md:h-9 rounded-lg border border-borde-campo bg-fondo-superficie px-esp2 text-base md:text-sm text-texto-primario"
          >
            {METODOS_COBRO.map((m) => (
              <option key={m.valor} value={m.valor}>
                {m.etiqueta}
              </option>
            ))}
          </select>
          <input
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Referencia (opcional)"
            className="h-11 md:h-9 rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
          <Boton type="submit" variante="secundario" cargando={pendiente}>
            {esDevolucion ? "Registrar devolución al cliente" : "Registrar cobro"}
          </Boton>
        </form>
      ) : (
        <div className="flex flex-col gap-esp2">
          <p className="text-xs text-texto-exito">
            {esRectificativa ? "Rectificativa liquidada por completo." : "Factura cobrada por completo."}
          </p>
          {compartir && (
            <>
              <p className="text-xs text-texto-terciario">
                Si el cliente pide un justificante, saca la factura con el sello «PAGADA».
              </p>
              <Link href={`/admin/documentos/${documentoId}/imprimir?pagada=1`} className={clasesBoton("secundario", "m")}>
                <Icono nombre="descargar" size={16} />
                Imprimir con sello «PAGADA»
              </Link>
              <BotonCompartir
                documentoId={documentoId}
                {...compartir}
                archivo={`${compartir.archivo} PAGADA`}
                pagada
                etiqueta="Compartir con sello «PAGADA»"
              />
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
