"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { BotonSalirBorrador } from "@/components/admin/boton-salir-borrador";
import { etiquetaReglaVencimiento, resolverVencimientoDefecto, type ReglaVencimiento } from "@/lib/documentos";
import { guardarCabecera } from "./acciones";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";
import { hoyEnEspana } from "@/lib/redondeo";

// Fecha de hoy en España (antes era la de UTC: de 0 a 2 h salía el día anterior).
export const hoy = () => hoyEnEspana();

/**
 * Cambios de «Condiciones» aún sin guardar. Las condiciones y el botón de emitir son formularios distintos:
 * gracias a este contexto, «Emitir» guarda antes lo que se haya cambiado en vez de perderlo.
 */
type GuardarPendiente = (() => Promise<void>) | null;
export const ContextoCondiciones = createContext<{
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

/** Botón «Salir» en el paso 4 (borrador): si hay cambios en «Condiciones», los guarda al elegir conservar. */
export function BotonSalirConCondiciones({ documentoId }: { documentoId: number }) {
  const guardarPendiente = useContext(ContextoCondiciones)?.guardarPendiente ?? null;
  return <BotonSalirBorrador documentoId={documentoId} antesDeGuardar={guardarPendiente} />;
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
                  ? "h-8 rounded-md border border-borde-marca bg-fondo-marca-sutil px-esp2 text-xs font-medium text-texto-marca transition-colors duration-rapida ease-suave active:scale-press"
                  : "h-8 rounded-md border border-borde-default px-esp2 text-xs text-texto-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
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

/** Condiciones de un borrador: vencimiento, forma de pago, descuento, retención y textos del documento. */
export function CondicionesDocumento({
  documentoId,
  tipo,
  inicial,
  formasPago,
  vencimientoCliente = null,
  vencimientoGeneral = { dias: 30 },
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
  vencimientoCliente?: ReglaVencimiento | null;
  vencimientoGeneral?: ReglaVencimiento;
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
    "rounded-lg border border-borde-campo bg-fondo-superficie px-esp3 py-esp2 text-base text-texto-primario outline-none focus:border-borde-foco md:text-sm";
  const etiqueta = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";
  const esPresupuesto = tipo === "presupuesto";
  const formaSeleccionada = formasPago.find((f) => String(f.id) === formaPagoId);
  // Plazos a elegir: solo si la forma de pago es aplazada (y no en presupuestos).
  const plazosForma = esPresupuesto ? [] : (formaSeleccionada?.plazos_dias ?? []);
  const defectoVencimiento = resolverVencimientoDefecto({
    cliente: vencimientoCliente,
    diasFormaPago: formaSeleccionada?.dias_vencimiento ?? null,
    general: vencimientoGeneral,
  });
  const textoOrigenVencimiento =
    defectoVencimiento.origen === "cliente"
      ? "ficha del cliente"
      : defectoVencimiento.origen === "forma_pago"
        ? "forma de pago"
        : "ajuste general";

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
          ) : esPresupuesto ? (
            <span className="pb-1 text-xs text-texto-terciario">Vacío = se calcula al emitir.</span>
          ) : (
            <span className="pb-1 text-xs text-texto-terciario">
              Vacío = {etiquetaReglaVencimiento(defectoVencimiento.regla).toLowerCase()} ({textoOrigenVencimiento}).
            </span>
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
          <span className="animate-estado-entrar text-xs text-texto-exito" role="status">
            Guardado
          </span>
        )}
      </div>
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </form>
  );
}
