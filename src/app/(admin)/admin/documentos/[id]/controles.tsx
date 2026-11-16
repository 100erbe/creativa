"use client";

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { METODOS_COBRO, type MetodoCobro } from "@/lib/documentos";
import {
  emitirDocumento,
  convertirDocumento,
  duplicarDocumento,
  nuevaVersionPresupuesto,
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
import { BotonCompartir } from "./boton-compartir";

const hoy = () => new Date().toISOString().slice(0, 10);

/**
 * Cambios de «Condiciones» aún sin guardar. Las condiciones y el botón de emitir son formularios distintos:
 * gracias a este contexto, «Emitir» guarda antes lo que se haya cambiado en vez de perderlo.
 */
type GuardarPendiente = (() => Promise<void>) | null;
const ContextoCondiciones = createContext<{
  guardarPendiente: GuardarPendiente;
  registrar: (guardar: GuardarPendiente) => void;
} | null>(null);

export function ProveedorCondiciones({ children }: { children: React.ReactNode }) {
  const [guardarPendiente, setGuardarPendiente] = useState<GuardarPendiente>(null);
  const registrar = useCallback((guardar: GuardarPendiente) => setGuardarPendiente(() => guardar), []);
  return (
    <ContextoCondiciones.Provider value={{ guardarPendiente, registrar }}>{children}</ContextoCondiciones.Provider>
  );
}

/** Plazos que ofrece la forma de pago aplazada (p. ej. 30, 60, 90 días); el selector de fecha sigue disponible. */
function PlazosRapidos({
  plazos,
  elegido,
  alElegir,
}: {
  plazos: number[];
  elegido: number | null;
  alElegir: (dias: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1" role="group" aria-label="Plazo del resto">
        {plazos.map((dias) => {
          const activo = elegido === dias;
          return (
            <button
              key={dias}
              type="button"
              onClick={() => alElegir(activo ? null : dias)}
              aria-pressed={activo}
              className={
                activo
                  ? "h-8 rounded-md border border-borde-marca bg-fondo-marca-sutil px-esp2 text-xs font-medium text-texto-marca"
                  : "h-8 rounded-md border border-borde-default px-esp2 text-xs text-texto-secundario hover:bg-fondo-sutil"
              }
            >
              {dias} d
            </button>
          );
        })}
      </div>
      <span className="text-xs text-texto-terciario">
        {elegido ? `Resto a ${elegido} días desde la emisión.` : "Plazo del resto, o elige una fecha."}
      </span>
    </div>
  );
}

const ESTADOS_SEGUIMIENTO: string[] = ["emitido", "enviado", "aceptado", "rechazado", "caducado"];

/** Botones de la ficha: emitir (borrador), convertir, duplicar y eliminar. */
export function AccionesDocumento({
  documentoId,
  tipo,
  estado,
  etiquetaTipo,
  mailto,
  hayDestinatario,
  compartir,
  facturaEnBorradorId = null,
  versionEnBorradorId = null,
  vencido = false,
}: {
  documentoId: number;
  tipo: string;
  estado: string;
  etiquetaTipo: string;
  /** Enlace mailto: ya preparado (null en los borradores). */
  mailto: string | null;
  hayDestinatario: boolean;
  /** Datos para compartir el PDF. */
  compartir: { archivo: string; titulo: string; texto: string };
  /** Factura en borrador creada desde este presupuesto/albarán (aún sin emitir). */
  facturaEnBorradorId?: number | null;
  /** Versión nueva de este presupuesto aún en borrador. */
  versionEnBorradorId?: number | null;
  /** Presupuesto con el «válido hasta» ya pasado. */
  vencido?: boolean;
}) {
  const { router, pendiente, error, ejecutar } = useAccion();
  const condiciones = useContext(ContextoCondiciones);
  const guardarCondiciones = condiciones?.guardarPendiente ?? null;
  const [fecha, setFecha] = useState(hoy());
  const [motivo, setMotivo] = useState("");
  const [confirmarEmision, setConfirmarEmision] = useState(false);
  // Tras compartir o enviar por email un presupuesto recién emitido, se propone marcarlo como enviado.
  const [ofrecerEnviado, setOfrecerEnviado] = useState(false);

  const esBorrador = estado === "borrador";
  const emitido = !esBorrador && estado !== "anulado";
  // Presupuesto todavía en juego (ni facturado, ni sustituido, ni anulado).
  const presupuestoVivo = tipo === "presupuesto" && ESTADOS_SEGUIMIENTO.includes(estado);
  const puedeOfrecerEnviado = tipo === "presupuesto" && estado === "emitido";
  const alEnviar = () => {
    if (puedeOfrecerEnviado) setOfrecerEnviado(true);
  };

  async function convertirEnFactura() {
    const aviso =
      estado === "rechazado" || estado === "caducado"
        ? `Este presupuesto está marcado como «${estado === "rechazado" ? "Rechazado" : "Caducado"}». ¿Convertirlo en factura igualmente?`
        : vencido
          ? "La validez de este presupuesto ya ha vencido. ¿Convertirlo en factura igualmente?"
          : null;
    if (aviso && !(await confirmar(aviso))) return;
    ejecutar(async () => {
      const nuevo = await desenvolver(convertirDocumento(documentoId, "factura"));
      router.push(`/admin/documentos/${nuevo}`);
    });
  }

  return (
    <div className="flex flex-col gap-esp3">
      <Link href={`/admin/documentos/${documentoId}/imprimir`} className="contents">
        <Boton variante="secundario">
          <Icono nombre="descargar" size={16} />
          Imprimir / PDF
        </Boton>
      </Link>

      <BotonCompartir documentoId={documentoId} {...compartir} alCompartir={alEnviar} />

      {mailto && (
        <div className="flex flex-col gap-1">
          <a
            href={mailto}
            onClick={alEnviar}
            className="inline-flex h-10 items-center justify-center gap-esp2 rounded-md border border-borde-campo bg-fondo-superficie px-esp4 text-sm font-medium text-texto-primario hover:bg-fondo-sutil"
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

      {ofrecerEnviado && puedeOfrecerEnviado && (
        <div className="flex flex-col gap-esp2 rounded-md border border-borde-info bg-fondo-info-sutil px-esp3 py-esp3" role="status">
          <p className="text-xs text-texto-primario">¿Se lo has enviado al cliente?</p>
          <div className="flex gap-esp2">
            <Boton
              tamano="s"
              cargando={pendiente}
              onClick={() =>
                ejecutar(async () => {
                  await desenvolver(cambiarEstadoPresupuesto(documentoId, "enviado"));
                  setOfrecerEnviado(false);
                  router.refresh();
                })
              }
            >
              Marcar como enviado
            </Boton>
            <Boton tamano="s" variante="secundario" onClick={() => setOfrecerEnviado(false)}>
              Todavía no
            </Boton>
          </div>
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
              className="h-11 md:h-9 rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario"
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
                Se le asignará su número definitivo y <strong>ya no podrá editarse</strong>.
                {guardarCondiciones && " Antes se guardarán los cambios de «Condiciones»."} ¿Continuar?
              </p>
              <div className="flex gap-esp2">
                <Boton
                  tamano="s"
                  cargando={pendiente}
                  onClick={() =>
                    ejecutar(async () => {
                      // Lo cambiado en «Condiciones» y no guardado entra en el documento antes de congelarlo.
                      if (guardarCondiciones) await guardarCondiciones();
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

      {presupuestoVivo && (
        <div className="flex flex-col gap-esp2 rounded-md bg-fondo-sutil px-esp3 py-esp3">
          <p className="text-xs font-medium text-texto-secundario">Seguimiento del presupuesto</p>
          {vencido && (
            <p className="text-xs text-texto-aviso">
              La validez ya ha vencido: márcalo como «Caducado», o como «Aceptado» si el cliente lo ha aceptado.
            </p>
          )}
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

      {versionEnBorradorId && presupuestoVivo && (
        <div className="flex flex-col gap-1">
          <Link href={`/admin/documentos/${versionEnBorradorId}`} className="contents">
            <Boton>Continuar la nueva versión en borrador</Boton>
          </Link>
          <p className="text-xs text-texto-terciario">
            Este presupuesto pasará a «Sustituido» cuando emitas la versión nueva. Si eliminas ese borrador, sigue
            vigente.
          </p>
        </div>
      )}

      {facturaEnBorradorId && estado !== "facturado" && (
        <div className="flex flex-col gap-1">
          <Link href={`/admin/documentos/${facturaEnBorradorId}`} className="contents">
            <Boton>Continuar la factura en borrador</Boton>
          </Link>
          <p className="text-xs text-texto-terciario">
            Pasará a «Facturado» cuando emitas la factura. Si eliminas el borrador, podrás volver a convertirlo.
          </p>
        </div>
      )}

      {!facturaEnBorradorId &&
        !versionEnBorradorId &&
        (presupuestoVivo || (tipo === "albaran" && emitido && estado !== "facturado")) && (
          <Boton cargando={pendiente} onClick={convertirEnFactura}>
            Convertir en factura
          </Boton>
        )}

      {!facturaEnBorradorId && !versionEnBorradorId && presupuestoVivo && (
        <div className="flex flex-col gap-1">
          <Boton
            variante="secundario"
            disabled={pendiente}
            onClick={() =>
              ejecutar(async () => {
                const nuevo = await desenvolver(nuevaVersionPresupuesto(documentoId));
                router.push(`/admin/documentos/nuevo?documento=${nuevo}`);
              })
            }
          >
            <Icono nombre="copiar" size={16} />
            Nueva versión (modificar)
          </Boton>
          <p className="text-xs text-texto-terciario">
            Crea una copia editable enlazada a este presupuesto. Al emitirla, este quedará como «Sustituido».
          </p>
        </div>
      )}

      {emitido && tipo === "factura" && (
        <div className="flex flex-col gap-esp2">
          <input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo de la rectificación (opcional)"
            className="h-11 md:h-9 rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario outline-none focus:border-borde-foco"
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
  compartir,
}: {
  documentoId: number;
  pendiente: number;
  cobros: { id: number; fecha: string; importe: number; metodo: string; referencia: string | null }[];
  /** Datos para compartir el PDF (con sello «PAGADA» cuando está cobrada). */
  compartir?: { archivo: string; titulo: string; texto: string };
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
              className="h-11 md:h-9 w-[110px] rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario"
            />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha del cobro"
              className="h-11 md:h-9 flex-1 rounded-md border border-borde-campo bg-fondo-superficie px-esp2 text-base md:text-sm text-texto-primario"
            />
          </div>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as MetodoCobro)}
            aria-label="Método de cobro"
            className="h-11 md:h-9 rounded-md border border-borde-campo bg-fondo-superficie px-esp2 text-base md:text-sm text-texto-primario"
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
            className="h-11 md:h-9 rounded-md border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
          <Boton type="submit" variante="secundario" cargando={pendiente}>
            Registrar cobro
          </Boton>
        </form>
      ) : (
        <div className="flex flex-col gap-esp2">
          <p className="text-xs text-texto-exito">Factura cobrada por completo.</p>
          {compartir && (
            <>
              <p className="text-xs text-texto-terciario">
                Si el cliente pide un justificante, saca la factura con el sello «PAGADA».
              </p>
              <Link href={`/admin/documentos/${documentoId}/imprimir?pagada=1`} className="contents">
                <Boton variante="secundario">
                  <Icono nombre="descargar" size={16} />
                  Imprimir con sello «PAGADA»
                </Boton>
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
    plazoDias: number | null;
    validoHasta: string | null;
    formaPagoId: number | null;
    descuentoGlobalPct: number;
    retencionPct: number;
    campana: string | null;
    descripcion: string | null;
    notasCliente: string | null;
  };
  formasPago: { id: number; nombre: string; dias_vencimiento: number; plazos_dias: number[] }[];
}) {
  const { router, pendiente, error, ejecutar } = useAccion();
  const [guardado, setGuardado] = useState(false);
  const [fechaVencimiento, setFechaVencimiento] = useState(inicial.fechaVencimiento ?? "");
  const [plazoDias, setPlazoDias] = useState<number | null>(inicial.plazoDias);
  const [validoHasta, setValidoHasta] = useState(inicial.validoHasta ?? "");
  const [formaPagoId, setFormaPagoId] = useState(inicial.formaPagoId ? String(inicial.formaPagoId) : "");
  const [descuento, setDescuento] = useState(String(inicial.descuentoGlobalPct).replace(".", ","));
  const [retencion, setRetencion] = useState(String(inicial.retencionPct).replace(".", ","));
  const [campana, setCampana] = useState(inicial.campana ?? "");
  const [descripcion, setDescripcion] = useState(inicial.descripcion ?? "");
  const [notas, setNotas] = useState(inicial.notasCliente ?? "");

  const num = (v: string) => (v.trim() === "" ? 0 : Number(v.replace(",", ".")));
  const area =
    "rounded-md border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";
  const etiqueta = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";
  const esPresupuesto = tipo === "presupuesto";
  // Plazos a elegir: solo si la forma de pago es aplazada (y no en presupuestos).
  const plazosForma = esPresupuesto ? [] : (formasPago.find((f) => String(f.id) === formaPagoId)?.plazos_dias ?? []);

  const datos = {
    fechaVencimiento,
    plazoDias: plazosForma.includes(plazoDias ?? -1) ? plazoDias : null,
    validoHasta,
    formaPagoId: formaPagoId ? Number(formaPagoId) : null,
    descuentoGlobalPct: num(descuento),
    retencionPct: num(retencion),
    campana,
    descripcion,
    notasCliente: notas,
  };
  // ¿Hay algo cambiado respecto a lo guardado? (un número mal escrito cuenta como cambio: al guardar dará error)
  const sinCambios =
    datos.fechaVencimiento === (inicial.fechaVencimiento ?? "") &&
    datos.plazoDias === inicial.plazoDias &&
    datos.validoHasta === (inicial.validoHasta ?? "") &&
    datos.formaPagoId === inicial.formaPagoId &&
    datos.descuentoGlobalPct === inicial.descuentoGlobalPct &&
    datos.retencionPct === inicial.retencionPct &&
    datos.campana.trim() === (inicial.campana ?? "") &&
    datos.descripcion.trim() === (inicial.descripcion ?? "") &&
    datos.notasCliente.trim() === (inicial.notasCliente ?? "");
  const claveDatos = JSON.stringify(datos);

  // Se avisa a «Emitir» de que hay cambios por guardar (y de cómo guardarlos).
  const registrar = useContext(ContextoCondiciones)?.registrar;
  useEffect(() => {
    if (!registrar) return;
    registrar(sinCambios ? null : () => desenvolver(guardarCabecera(documentoId, JSON.parse(claveDatos))));
    return () => registrar(null);
  }, [registrar, sinCambios, claveDatos, documentoId]);

  return (
    <form
      className="flex flex-col gap-esp3"
      onSubmit={(e) => {
        e.preventDefault();
        setGuardado(false);
        ejecutar(async () => {
          await desenvolver(guardarCabecera(documentoId, datos));
          setGuardado(true);
          router.refresh();
        });
      }}
    >
      <label className={etiqueta}>
        Forma de pago
        <select
          value={formaPagoId}
          onChange={(e) => {
            setFormaPagoId(e.target.value);
            setPlazoDias(null);
          }}
          className={CAMPO}
        >
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
              onChange={(e) => {
                setFechaVencimiento(e.target.value);
                setPlazoDias(null);
              }}
              className={CAMPO}
            />
          </label>
        )}
        <div className="flex items-end pb-1">
          {plazosForma.length > 0 ? (
            <PlazosRapidos
              plazos={plazosForma}
              elegido={plazoDias}
              alElegir={(dias) => {
                setPlazoDias(dias);
                if (dias) setFechaVencimiento("");
              }}
            />
          ) : (
            <span className="pb-1 text-xs text-texto-terciario">Vacío = se calcula al emitir.</span>
          )}
        </div>
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
