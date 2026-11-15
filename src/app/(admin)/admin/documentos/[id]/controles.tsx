"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { METODOS_COBRO, type MetodoCobro } from "@/lib/documentos";
import {
  emitirDocumento,
  convertirDocumento,
  duplicarDocumento,
  eliminarBorrador,
  registrarCobro,
  eliminarCobro,
  cambiarEstadoPresupuesto,
  guardarCabecera,
} from "./acciones";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";
import { useAccion } from "@/lib/use-accion";

const hoy = () => new Date().toISOString().slice(0, 10);

const ESTADOS_SEGUIMIENTO: string[] = ["emitido", "enviado", "aceptado", "rechazado", "caducado"];

/** Botones de la ficha: emitir (borrador), convertir, duplicar y eliminar. */
export function AccionesDocumento({
  documentoId,
  tipo,
  estado,
  etiquetaTipo,
  mailto,
  hayDestinatario,
}: {
  documentoId: number;
  tipo: string;
  estado: string;
  etiquetaTipo: string;
  /** Enlace mailto: ya preparado (null en los borradores). */
  mailto: string | null;
  hayDestinatario: boolean;
}) {
  const { router, pendiente, error, ejecutar } = useAccion();
  const [fecha, setFecha] = useState(hoy());
  const [motivo, setMotivo] = useState("");
  const [confirmarEmision, setConfirmarEmision] = useState(false);

  const esBorrador = estado === "borrador";
  const emitido = !esBorrador && estado !== "anulado";

  return (
    <div className="flex flex-col gap-esp3">
      <Link href={`/admin/documentos/${documentoId}/imprimir`} className="contents">
        <Boton variante="secundario">
          <Icono nombre="descargar" size={16} />
          Imprimir / PDF
        </Boton>
      </Link>

      {mailto && (
        <div className="flex flex-col gap-1">
          <a
            href={mailto}
            className="inline-flex h-10 items-center justify-center gap-esp2 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp4 text-sm font-medium text-texto-primario hover:bg-fondo-sutil"
          >
            <Icono nombre="enviar" size={16} />
            Enviar por email
          </a>
          <p className="text-xs text-texto-terciario">
            {hayDestinatario
              ? "Se abre tu correo con el mensaje preparado. Guarda antes el PDF (Imprimir / PDF) para adjuntarlo."
              : "El cliente no tiene email de facturación ni contacto que reciba facturas: añádelo en su ficha. Guarda antes el PDF para adjuntarlo."}
          </p>
        </div>
      )}

      {esBorrador && (
        <>
          <label className="flex flex-col gap-1 text-xs text-texto-secundario">
            Fecha del documento
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-11 md:h-9 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario"
            />
          </label>

          {!confirmarEmision ? (
            <Boton onClick={() => setConfirmarEmision(true)} disabled={pendiente}>
              <Icono nombre="check" size={16} />
              Emitir {etiquetaTipo.toLowerCase()}
            </Boton>
          ) : (
            <div className="flex flex-col gap-esp2 rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp3 py-esp3">
              <p className="text-xs text-texto-primario">
                Se le asignará su número definitivo y <strong>ya no podrá editarse</strong>. ¿Continuar?
              </p>
              <div className="flex gap-esp2">
                <Boton
                  tamano="s"
                  cargando={pendiente}
                  onClick={() =>
                    ejecutar(async () => {
                      await desenvolver(emitirDocumento(documentoId, fecha));
                      setConfirmarEmision(false);
                      router.refresh();
                    })
                  }
                >
                  Sí, emitir
                </Boton>
                <Boton tamano="s" variante="secundario" onClick={() => setConfirmarEmision(false)}>
                  Cancelar
                </Boton>
              </div>
            </div>
          )}

          <Boton
            variante="secundario"
            onClick={() => router.push(`/admin/documentos/nuevo?documento=${documentoId}`)}
          >
            Editar líneas
          </Boton>
        </>
      )}

      {tipo === "presupuesto" && ESTADOS_SEGUIMIENTO.includes(estado) && (
        <div className="flex flex-col gap-esp2 rounded-md bg-fondo-sutil px-esp3 py-esp3">
          <p className="text-xs font-medium text-texto-secundario">Seguimiento del presupuesto</p>
          <div className="grid grid-cols-2 gap-esp2">
            {(
              [
                ["enviado", "Enviado"],
                ["aceptado", "Aceptado"],
                ["rechazado", "Rechazado"],
                ["caducado", "Caducado"],
              ] as const
            ).map(([valor, etiqueta]) => (
              <Boton
                key={valor}
                tamano="s"
                variante={estado === valor ? "primario" : "secundario"}
                aria-pressed={estado === valor}
                disabled={pendiente}
                onClick={() =>
                  ejecutar(async () => {
                    await desenvolver(cambiarEstadoPresupuesto(documentoId, valor));
                    router.refresh();
                  })
                }
              >
                {etiqueta}
              </Boton>
            ))}
          </div>
          {estado !== "emitido" && (
            <button
              disabled={pendiente}
              onClick={() =>
                ejecutar(async () => {
                  await desenvolver(cambiarEstadoPresupuesto(documentoId, "emitido"));
                  router.refresh();
                })
              }
              className="w-fit text-xs font-medium text-texto-marca disabled:opacity-50"
            >
              Quitar el estado (volver a emitido)
            </button>
          )}
        </div>
      )}

      {emitido && (tipo === "presupuesto" || tipo === "albaran") && estado !== "facturado" && estado !== "rechazado" && estado !== "caducado" && (
        <Boton
          cargando={pendiente}
          onClick={() =>
            ejecutar(async () => {
              const nuevo = await desenvolver(convertirDocumento(documentoId, "factura"));
              router.push(`/admin/documentos/${nuevo}`);
            })
          }
        >
          Convertir en factura
        </Boton>
      )}

      {emitido && tipo === "factura" && (
        <div className="flex flex-col gap-esp2">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo de la rectificación (opcional)"
            className="h-11 md:h-9 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
          <Boton
            variante="secundario"
            cargando={pendiente}
            onClick={() =>
              ejecutar(async () => {
                const nuevo = await desenvolver(convertirDocumento(documentoId, "rectificativa", motivo));
                router.push(`/admin/documentos/${nuevo}`);
              })
            }
          >
            Crear rectificativa (abono total)
          </Boton>
        </div>
      )}

      <Boton
        variante="secundario"
        disabled={pendiente}
        onClick={() =>
          ejecutar(async () => {
            const nuevo = await desenvolver(duplicarDocumento(documentoId));
            router.push(`/admin/documentos/${nuevo}`);
          })
        }
      >
        <Icono nombre="copiar" size={16} />
        Duplicar como borrador
      </Boton>

      {esBorrador && (
        <Boton
          variante="peligro"
          disabled={pendiente}
          onClick={async () => {
            if (!(await confirmar("¿Eliminar este borrador? No se puede deshacer."))) return;
            ejecutar(async () => {
              await desenvolver(eliminarBorrador(documentoId));
              router.push("/admin/documentos");
            });
          }}
        >
          Eliminar borrador
        </Boton>
      )}

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

/** Formulario para anotar un cobro y lista de cobros ya registrados. */
export function Cobros({
  documentoId,
  pendiente: importePendiente,
  cobros,
}: {
  documentoId: number;
  pendiente: number;
  cobros: { id: number; fecha: string; importe: number; metodo: string; referencia: string | null }[];
}) {
  const { router, pendiente, error, ejecutar } = useAccion();
  const [importe, setImporte] = useState(importePendiente > 0 ? importePendiente.toFixed(2) : "");
  const [fecha, setFecha] = useState(hoy());
  const [metodo, setMetodo] = useState<MetodoCobro>("transferencia");
  const [referencia, setReferencia] = useState("");

  const euros = (v: number) =>
    new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(v);

  return (
    <div className="flex flex-col gap-esp3">
      {cobros.length > 0 && (
        <div className="flex flex-col divide-y divide-fondo-hover">
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

      {importePendiente > 0.005 ? (
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
              aria-label="Importe cobrado"
              className="h-11 md:h-9 w-[110px] rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario"
            />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha del cobro"
              className="h-11 md:h-9 flex-1 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp2 text-base md:text-sm text-texto-primario"
            />
          </div>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as MetodoCobro)}
            aria-label="Método de cobro"
            className="h-11 md:h-9 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp2 text-base md:text-sm text-texto-primario"
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
            className="h-11 md:h-9 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
          <Boton type="submit" variante="secundario" cargando={pendiente}>
            Registrar cobro
          </Boton>
        </form>
      ) : (
        <p className="text-xs text-texto-exito">Factura cobrada por completo.</p>
      )}

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

/** Condiciones de un borrador: vencimiento, forma de pago, descuento, retención y textos del documento. */
export function CondicionesDocumento({
  documentoId,
  tipo,
  inicial,
  formasPago,
}: {
  documentoId: number;
  tipo: string;
  inicial: {
    fechaVencimiento: string | null;
    validoHasta: string | null;
    formaPagoId: number | null;
    descuentoGlobalPct: number;
    retencionPct: number;
    campana: string | null;
    descripcion: string | null;
    notasCliente: string | null;
  };
  formasPago: { id: number; nombre: string; dias_vencimiento: number }[];
}) {
  const { router, pendiente, error, ejecutar } = useAccion();
  const [guardado, setGuardado] = useState(false);
  const [fechaVencimiento, setFechaVencimiento] = useState(inicial.fechaVencimiento ?? "");
  const [validoHasta, setValidoHasta] = useState(inicial.validoHasta ?? "");
  const [formaPagoId, setFormaPagoId] = useState(inicial.formaPagoId ? String(inicial.formaPagoId) : "");
  const [descuento, setDescuento] = useState(String(inicial.descuentoGlobalPct).replace(".", ","));
  const [retencion, setRetencion] = useState(String(inicial.retencionPct).replace(".", ","));
  const [campana, setCampana] = useState(inicial.campana ?? "");
  const [descripcion, setDescripcion] = useState(inicial.descripcion ?? "");
  const [notas, setNotas] = useState(inicial.notasCliente ?? "");

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(",", ".")));
  const area =
    "rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";
  const etiqueta = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";
  const esPresupuesto = tipo === "presupuesto";

  return (
    <form
      className="flex flex-col gap-esp3"
      onSubmit={(e) => {
        e.preventDefault();
        setGuardado(false);
        ejecutar(async () => {
          await desenvolver(
            guardarCabecera(documentoId, {
              fechaVencimiento,
              validoHasta,
              formaPagoId: formaPagoId ? Number(formaPagoId) : null,
              descuentoGlobalPct: num(descuento),
              retencionPct: num(retencion),
              campana,
              descripcion,
              notasCliente: notas,
            }),
          );
          setGuardado(true);
          router.refresh();
        });
      }}
    >
      <label className={etiqueta}>
        Forma de pago
        <select value={formaPagoId} onChange={(e) => setFormaPagoId(e.target.value)} className={CAMPO}>
          <option value="">Sin especificar</option>
          {formasPago.map((f) => (
            <option key={f.id} value={f.id}>
              {f.nombre}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-esp3">
        {esPresupuesto ? (
          <label className={etiqueta}>
            Válido hasta
            <input type="date" value={validoHasta} onChange={(e) => setValidoHasta(e.target.value)} className={CAMPO} />
          </label>
        ) : (
          <label className={etiqueta}>
            Vencimiento
            <input
              type="date"
              value={fechaVencimiento}
              onChange={(e) => setFechaVencimiento(e.target.value)}
              className={CAMPO}
            />
          </label>
        )}
        <div className="flex items-end pb-2 text-xs text-texto-terciario">Vacío = se calcula al emitir.</div>
        <label className={etiqueta}>
          Descuento global (%)
          <input value={descuento} onChange={(e) => setDescuento(e.target.value)} inputMode="decimal" className={CAMPO} />
        </label>
        <label className={etiqueta}>
          Retención IRPF (%)
          <input value={retencion} onChange={(e) => setRetencion(e.target.value)} inputMode="decimal" className={CAMPO} />
        </label>
      </div>
      <label className={etiqueta}>
        Campaña / artista (sale en el documento)
        <input value={campana} onChange={(e) => setCampana(e.target.value)} className={CAMPO} />
      </label>
      <label className={etiqueta}>
        Descripción
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} rows={2} className={area} />
      </label>
      <label className={etiqueta}>
        Notas para el cliente
        <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} className={area} />
      </label>
      <div className="flex items-center gap-esp3">
        <Boton type="submit" variante="secundario" cargando={pendiente}>
          Guardar condiciones
        </Boton>
        {guardado && !error && (
          <span className="text-xs text-texto-exito" role="status">
            Guardado
          </span>
        )}
      </div>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </form>
  );
}
