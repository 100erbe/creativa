"use client";

import { useState, useTransition } from "react";
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
} from "./acciones";

function useAccion() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar(accion: () => Promise<void>) {
    setError(null);
    iniciar(async () => {
      try {
        await accion();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo completar la acción.");
      }
    });
  }
  return { router, pendiente, error, ejecutar };
}

const hoy = () => new Date().toISOString().slice(0, 10);

/** Botones de la ficha: emitir (borrador), convertir, duplicar y eliminar. */
export function AccionesDocumento({
  documentoId,
  tipo,
  estado,
  etiquetaTipo,
}: {
  documentoId: number;
  tipo: string;
  estado: string;
  etiquetaTipo: string;
}) {
  const { router, pendiente, error, ejecutar } = useAccion();
  const [fecha, setFecha] = useState(hoy());
  const [motivo, setMotivo] = useState("");
  const [confirmarEmision, setConfirmarEmision] = useState(false);

  const esBorrador = estado === "borrador";
  const emitido = !esBorrador && estado !== "anulado";

  return (
    <div className="flex flex-col gap-esp3">
      {esBorrador && (
        <>
          <label className="flex flex-col gap-1 text-xs text-texto-secundario">
            Fecha del documento
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-9 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-sm text-texto-primario"
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
                      await emitirDocumento(documentoId, fecha);
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

      {emitido && (tipo === "presupuesto" || tipo === "albaran") && estado !== "facturado" && (
        <Boton
          cargando={pendiente}
          onClick={() =>
            ejecutar(async () => {
              const nuevo = await convertirDocumento(documentoId, "factura");
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
            className="h-9 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco"
          />
          <Boton
            variante="secundario"
            cargando={pendiente}
            onClick={() =>
              ejecutar(async () => {
                const nuevo = await convertirDocumento(documentoId, "rectificativa", motivo);
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
            const nuevo = await duplicarDocumento(documentoId);
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
          onClick={() => {
            if (!confirm("¿Eliminar este borrador? No se puede deshacer.")) return;
            ejecutar(async () => {
              await eliminarBorrador(documentoId);
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
                onClick={() => {
                  if (!confirm("¿Eliminar este cobro?")) return;
                  ejecutar(async () => {
                    await eliminarCobro(documentoId, c.id);
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
              await registrarCobro(documentoId, {
                importe: Number(importe.replace(",", ".")),
                fecha,
                metodo,
                referencia,
              });
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
              className="h-9 w-[110px] rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-sm text-texto-primario"
            />
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              aria-label="Fecha del cobro"
              className="h-9 flex-1 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp2 text-sm text-texto-primario"
            />
          </div>
          <select
            value={metodo}
            onChange={(e) => setMetodo(e.target.value as MetodoCobro)}
            aria-label="Método de cobro"
            className="h-9 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp2 text-sm text-texto-primario"
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
            className="h-9 rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco"
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
