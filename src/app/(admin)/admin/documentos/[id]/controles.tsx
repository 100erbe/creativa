"use client";

import { useContext, useState } from "react";
import Link from "next/link";
import { Boton, clasesBoton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { MOTIVOS_RECTIFICACION, textoMotivoRectificacion } from "@/lib/documentos";
import { emitirDocumento, convertirDocumento, duplicarDocumento, nuevaVersionPresupuesto, eliminarBorrador, cambiarEstadoPresupuesto, anularDocumento } from "./acciones";
import { eliminarOptimista } from "@/lib/eliminacion-optimista";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";
import { useAccion } from "@/lib/use-accion";
import { BotonCompartir } from "./boton-compartir";
import { hoy, ContextoCondiciones } from "./condiciones-documento";

export { ProveedorCondiciones, BotonSalirConCondiciones, CondicionesDocumento } from "./condiciones-documento";
export { Cobros } from "./cobros-documento";
export { RevisionDocumento } from "./revision-documento";

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
  avisoEmision = null,
  facturaImportada = false,
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
  /** Aviso que hay que leer antes de emitir (p. ej. rectificativa que no abona lo que queda de la factura). */
  avisoEmision?: string | null;
  /** Factura que viene de la importación (Excel/PDF): sus líneas pueden no sumar su total. */
  facturaImportada?: boolean;
}) {
  const { router, pendiente, error, ejecutar } = useAccion();
  const condiciones = useContext(ContextoCondiciones);
  const guardarCondiciones = condiciones?.guardarPendiente ?? null;
  const [fecha, setFecha] = useState(hoy());
  const [claveMotivo, setClaveMotivo] = useState("");
  const [detalleMotivo, setDetalleMotivo] = useState("");
  const [confirmarEmision, setConfirmarEmision] = useState(false);
  // Tras compartir o enviar por email un presupuesto recién emitido, se propone marcarlo como enviado.
  const [ofrecerEnviado, setOfrecerEnviado] = useState(false);

  const motivoElegido = MOTIVOS_RECTIFICACION.find((m) => m.clave === claveMotivo);
  const motivoListo = !!motivoElegido && (!motivoElegido.detalleObligatorio || detalleMotivo.trim().length > 0);

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
      <Link href={`/admin/documentos/${documentoId}/imprimir`} className={clasesBoton("secundario", "m")}>
        <Icono nombre="descargar" size={16} />
        Imprimir / PDF
      </Link>

      <BotonCompartir documentoId={documentoId} {...compartir} alCompartir={alEnviar} />

      {mailto && (
        <div className="flex flex-col gap-1">
          <a
            href={mailto}
            onClick={alEnviar}
            className="inline-flex h-10 items-center justify-center gap-esp2 rounded-lg border border-borde-campo bg-fondo-superficie px-esp4 text-sm font-medium text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
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
        <div className="animate-estado-entrar flex flex-col gap-esp2 rounded-md border border-borde-info bg-fondo-info-sutil px-esp3 py-esp3" role="status">
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
              className="h-11 md:h-9 rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario"
            />
          </label>

          {!confirmarEmision ? (
            <Boton onClick={() => setConfirmarEmision(true)} disabled={pendiente}>
              <Icono nombre="check" size={16} />
              Emitir {etiquetaTipo.toLowerCase()}
            </Boton>
          ) : (
            <div className="animate-estado-entrar flex flex-col gap-esp2 rounded-md border border-borde-aviso bg-fondo-aviso-sutil px-esp3 py-esp3">
              {avisoEmision && (
                <p className="text-xs font-semibold text-texto-aviso" role="alert">
                  {avisoEmision} Si querías anular la factura entera, cancela y corrige las líneas.
                </p>
              )}
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
                  {avisoEmision ? "Emitir igualmente" : "Sí, emitir"}
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
          <Link href={`/admin/documentos/${versionEnBorradorId}`} className={clasesBoton("primario", "m")}>Continuar la nueva versión en borrador</Link>
          <p className="text-xs text-texto-terciario">
            Este presupuesto pasará a «Sustituido» cuando emitas la versión nueva. Si eliminas ese borrador, sigue
            vigente.
          </p>
        </div>
      )}

      {facturaEnBorradorId && estado !== "facturado" && (
        <div className="flex flex-col gap-1">
          <Link href={`/admin/documentos/${facturaEnBorradorId}`} className={clasesBoton("primario", "m")}>Continuar la factura en borrador</Link>
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
          <label className="flex flex-col gap-1 text-xs text-texto-secundario">
            Motivo de la rectificación
            <select
              value={claveMotivo}
              onChange={(e) => setClaveMotivo(e.target.value)}
              className="h-11 md:h-9 rounded-lg border border-borde-campo bg-fondo-superficie px-esp2 text-base md:text-sm text-texto-primario"
            >
              <option value="" disabled>
                Elige el motivo…
              </option>
              {MOTIVOS_RECTIFICACION.map((m) => (
                <option key={m.clave} value={m.clave}>
                  {m.texto} ({m.causa})
                </option>
              ))}
            </select>
          </label>
          {motivoElegido && (
            <input
              value={detalleMotivo}
              onChange={(e) => setDetalleMotivo(e.target.value)}
              placeholder={
                motivoElegido.detalleObligatorio
                  ? motivoElegido.clave === "error_datos"
                    ? "¿Qué dato estaba mal? (p. ej. NIF del cliente)"
                    : "Describe el motivo"
                  : "Detalle (opcional)"
              }
              aria-label="Detalle del motivo"
              className="h-11 md:h-9 rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 text-base md:text-sm text-texto-primario outline-none focus:border-borde-foco"
            />
          )}
          <Boton
            variante="secundario"
            cargando={pendiente}
            disabled={!motivoListo}
            onClick={() =>
              ejecutar(async () => {
                const nuevo = await desenvolver(
                  convertirDocumento(
                    documentoId,
                    "rectificativa",
                    textoMotivoRectificacion(claveMotivo, detalleMotivo),
                    motivoElegido!.causa,
                  ),
                );
                router.push(`/admin/documentos/${nuevo}`);
              })
            }
          >
            Crear rectificativa (abono total)
          </Boton>
          <p className="text-xs text-texto-terciario">
            Se crea en borrador con todas las líneas en negativo. Para un abono parcial, ajusta las líneas antes de
            emitirla.
          </p>
          {facturaImportada && (
            <p className="text-xs text-texto-aviso">
              Factura importada: sus líneas pueden no sumar el total del PDF. Comprueba el importe del borrador antes
              de emitirlo.
            </p>
          )}
        </div>
      )}

      {(tipo === "presupuesto" || tipo === "albaran") && ESTADOS_SEGUIMIENTO.includes(estado) && (
        <Boton
          variante="peligro"
          disabled={pendiente}
          onClick={async () => {
            const seguro = await confirmar(
              `¿Anular este ${etiquetaTipo.toLowerCase()}? Quedará como «Anulado», ya no se podrá facturar y no se puede deshacer.`,
              { aceptar: "Anular", peligro: true },
            );
            if (!seguro) return;
            ejecutar(async () => {
              await desenvolver(anularDocumento(documentoId));
              router.refresh();
            });
          }}
        >
          Anular {etiquetaTipo.toLowerCase()}
        </Boton>
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
            // Optimista: se vuelve al listado (ya sin el borrador) mientras el servidor lo borra.
            router.push("/admin/documentos");
            if (!(await eliminarOptimista(`documento:${documentoId}`, () => desenvolver(eliminarBorrador(documentoId))))) {
              router.refresh();
            }
          }}
        >
          Eliminar borrador
        </Boton>
      )}

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}
