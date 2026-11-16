"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";
import {
  ETIQUETA_ESTADO_GASTO,
  ETIQUETA_FORMA_PAGO_GASTO,
  ETIQUETA_TIPO_GASTO,
  TONO_ESTADO_GASTO,
  type EstadoGasto,
  type FormaPagoGasto,
  type TipoGasto,
} from "@/lib/gastos";
import { cambiarEstadoGasto } from "./acciones";

export type GastoRevision = {
  id: number;
  codigo: string;
  tipo: TipoGasto;
  estado: EstadoGasto;
  concepto: string;
  fecha: string; // ya formateada
  total: string; // ya formateado
  responsable: string | null;
  categoria: string | null;
  formaPago: FormaPagoGasto;
  notas: string | null;
  proveedor: string | null;
  numeroFactura: string | null;
  urlTicket: string | null;
  esPdf: boolean;
};

/**
 * Panel de revisión de un gasto enviado por un empleado: datos, foto del ticket y decisión.
 * Al aceptar, el gasto pasa a "aprobado" y entra solo en el listado (y en los totales) de gastos menores.
 */
export function ModalRevisarGasto({ gasto, cerrarHref }: { gasto: GastoRevision; cerrarHref: string }) {
  const { router, pendiente, error, ejecutar } = useAccion();
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ampliada, setAmpliada] = useState(false);
  const deducible = gasto.tipo === "deducible";
  const decidible = gasto.estado === "pendiente";
  const faltaFactura = deducible && !gasto.urlTicket;

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && router.push(cerrarHref);
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [router, cerrarHref]);

  function decidir(estado: EstadoGasto, texto?: string) {
    ejecutar(async () => {
      await desenvolver(cambiarEstadoGasto(gasto.id, estado, texto));
      router.push(cerrarHref);
      router.refresh();
    });
  }

  return (
    <div className="fixed inset-0 z-[2500] flex items-end justify-center sm:items-center sm:p-esp4" role="dialog" aria-modal="true" aria-label="Revisar gasto">
      <Link href={cerrarHref} aria-label="Cerrar" className="absolute inset-0 bg-fondo-velo" />
      <div className="relative flex max-h-[92dvh] w-full flex-col gap-esp4 overflow-y-auto rounded-t-xl bg-fondo-superficie p-esp5 shadow-xl sm:max-w-lg sm:rounded-xl">
        <div className="flex items-start gap-esp3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-texto-terciario">
              {gasto.codigo} · {ETIQUETA_TIPO_GASTO[gasto.tipo]}
            </p>
            <h2 className="text-lg font-semibold text-texto-primario">{gasto.concepto}</h2>
          </div>
          <Insignia tono={TONO_ESTADO_GASTO[gasto.estado]}>{ETIQUETA_ESTADO_GASTO[gasto.estado]}</Insignia>
          <Link
            href={cerrarHref}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-md text-icono-secundario hover:bg-fondo-sutil"
          >
            <Icono nombre="cerrar" size={20} />
          </Link>
        </div>

        <p className="text-3xl font-semibold tracking-tight text-texto-primario">{gasto.total}</p>

        <dl className="grid grid-cols-2 gap-x-esp4 gap-y-esp3 text-sm">
          {[
            ["Enviado por", gasto.responsable],
            ["Fecha", gasto.fecha],
            ["Categoría", gasto.categoria],
            ["Forma de pago", ETIQUETA_FORMA_PAGO_GASTO[gasto.formaPago]],
            ...(deducible ? [["Proveedor", gasto.proveedor], ["Nº de factura", gasto.numeroFactura]] : []),
          ].map(([k, v]) => (
            <div key={k as string}>
              <dt className="text-xs text-texto-terciario">{k}</dt>
              <dd className="text-texto-primario">{v || "—"}</dd>
            </div>
          ))}
          {gasto.notas && (
            <div className="col-span-2">
              <dt className="text-xs text-texto-terciario">Notas</dt>
              <dd className="text-texto-primario">{gasto.notas}</dd>
            </div>
          )}
        </dl>

        <div className="flex flex-col gap-esp2">
          <p className="text-xs font-medium text-texto-secundario">{deducible ? "Factura" : "Ticket"}</p>
          {gasto.urlTicket ? (
            gasto.esPdf ? (
              <a href={gasto.urlTicket} target="_blank" rel="noreferrer" className="text-sm font-medium text-texto-marca">
                Abrir PDF 📄
              </a>
            ) : (
              <button type="button" onClick={() => setAmpliada((v) => !v)} className="text-left">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={gasto.urlTicket}
                  alt="Ticket del gasto"
                  className={`w-full rounded-md border border-borde-default object-contain ${ampliada ? "max-h-none" : "max-h-72"}`}
                />
                <span className="text-xs text-texto-terciario">{ampliada ? "Toca para reducir" : "Toca para ampliar"}</span>
              </button>
            )
          ) : (
            <p className="text-sm text-texto-aviso">⚠ Sin {deducible ? "factura" : "ticket"} adjunto.</p>
          )}
        </div>

        {decidible ? (
          <div className="flex flex-col gap-esp3">
            {rechazando ? (
              <div className="flex flex-col gap-esp2 rounded-md border border-borde-default bg-fondo-sutil p-esp3">
                <input
                  autoFocus
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Motivo del rechazo (lo verá el empleado)"
                  className="h-9 w-full rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-sm outline-none focus:border-borde-foco"
                />
                <div className="flex gap-esp2">
                  <Boton variante="peligro" tamano="s" cargando={pendiente} disabled={!motivo.trim()} onClick={() => decidir("rechazado", motivo)}>
                    Confirmar rechazo
                  </Boton>
                  <Boton variante="secundario" tamano="s" onClick={() => setRechazando(false)}>
                    Volver
                  </Boton>
                </div>
              </div>
            ) : (
              <div className="flex gap-esp3">
                <Boton className="flex-1" cargando={pendiente} disabled={faltaFactura} onClick={() => decidir("aprobado")}>
                  Aceptar
                </Boton>
                <Boton className="flex-1" variante="secundario" disabled={pendiente} onClick={() => setRechazando(true)}>
                  Rechazar…
                </Boton>
              </div>
            )}
            {!rechazando && (
              <p className="text-xs text-texto-terciario">
                {faltaFactura
                  ? "Un gasto deducible necesita la factura adjunta para aceptarse."
                  : deducible
                    ? "Al aceptar entra en el IVA soportado."
                    : "Al aceptar, el gasto se añade a los gastos menores y el empleado recibe un aviso."}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-texto-secundario">Este gasto ya está {ETIQUETA_ESTADO_GASTO[gasto.estado].toLowerCase()}.</p>
        )}
        {error && <p className="text-sm text-texto-peligro">{error}</p>}

        <Link href={`/admin/gastos/${gasto.id}`} className="text-center text-sm font-medium text-texto-marca">
          Abrir ficha completa
        </Link>
      </div>
    </div>
  );
}
