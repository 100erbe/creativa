"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Insignia } from "@/components/ui/insignia";
import { InsigniaMargen } from "@/components/ui/insignia-margen";
import { Pestanas } from "@/components/ui/pestanas";
import { CabeceraTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { formatoCantidad } from "@/lib/documento-impresion";
import { ETIQUETA_TIPO, ETIQUETA_UNIDAD } from "@/lib/documentos";
import { euros, fechaMedia } from "@/lib/formato";
import type { ResumenMargen } from "@/lib/margen";
import { calcularMargenCliente, type FilaMargen } from "@/lib/margen-cliente";
import { BotonOjoMargenes, useMargenesVisibles } from "@/lib/margenes-visibles";

const LIMITE = 5;

/**
 * Rentabilidad del cliente: margen real (facturas − rectificativas), margen previsto (presupuestos
 * abiertos), por documento y por producto. Datos internos: se ocultan con el ojo y nunca salen de la app.
 */
export function RentabilidadCliente({
  filas,
  numeros,
  nombresProducto,
  anioActual,
}: {
  filas: FilaMargen[];
  numeros: [number, string | null][];
  nombresProducto: [number, string][];
  anioActual: number;
}) {
  const visible = useMargenesVisibles();
  const [periodo, setPeriodo] = useState<"anio" | "todo">("anio");
  const [vista, setVista] = useState<"documento" | "producto">("documento");
  const [verTodo, setVerTodo] = useState(false);

  const margen = useMemo(
    () =>
      calcularMargenCliente(filas, {
        anio: periodo === "anio" ? anioActual : undefined,
        numeros: new Map(numeros),
        nombresProducto: new Map(nombresProducto),
      }),
    [filas, numeros, nombresProducto, periodo, anioActual],
  );

  const lista = vista === "documento" ? margen.porDocumento : margen.porProducto;
  const visibles = verTodo ? lista : lista.slice(0, LIMITE);

  return (
    <Tarjeta como="section" relleno="panel" aria-labelledby="titulo-rentabilidad" className="gap-esp4 md:gap-esp4">
      <CabeceraTarjeta
        id="titulo-rentabilidad"
        titulo="Rentabilidad"
        descripcion="Margen bruto aproximado · solo lo ves tú"
        accion={<BotonOjoMargenes />}
      />

      {!visible ? (
        <p className="text-sm text-texto-terciario">Márgenes ocultos en este dispositivo.</p>
      ) : (
        <>
          <Pestanas
            etiqueta="Periodo de la rentabilidad"
            valor={periodo}
            onCambio={(v) => {
              setPeriodo(v);
              setVerTodo(false);
            }}
            opciones={[
              { valor: "anio", etiqueta: `Año ${anioActual}` },
              { valor: "todo", etiqueta: "Todo" },
            ]}
          />

          <div className="grid grid-cols-1 gap-esp3 sm:grid-cols-2">
            <Resumen titulo="Margen bruto (facturas)" resumen={margen.real} vacio="Sin facturas con coste en este periodo." />
            <Resumen
              titulo="Margen previsto (presupuestos abiertos)"
              resumen={margen.previsto}
              vacio="Sin presupuestos abiertos con coste."
            />
          </div>

          {margen.real.lineasSinCoste > 0 && (
            <p className="text-xs text-texto-terciario">
              {euros(margen.real.baseSinCoste)} facturados en {margen.real.lineasSinCoste}{" "}
              {margen.real.lineasSinCoste === 1 ? "línea" : "líneas"} sin coste: fuera del cálculo.
            </p>
          )}

          {(margen.porDocumento.length > 0 || margen.porProducto.length > 0) && (
            <div className="flex flex-col gap-esp2">
              <Pestanas
                etiqueta="Detalle de la rentabilidad"
                valor={vista}
                onCambio={(v) => {
                  setVista(v);
                  setVerTodo(false);
                }}
                opciones={[
                  { valor: "documento", etiqueta: "Por documento", contador: margen.porDocumento.length },
                  { valor: "producto", etiqueta: "Por producto", contador: margen.porProducto.length },
                ]}
              />
              <ul className="flex flex-col divide-y divide-borde-default">
                {vista === "documento"
                  ? margen.porDocumento.slice(0, verTodo ? undefined : LIMITE).map((d) => (
                      <li key={d.id}>
                        <Link
                          href={`/admin/documentos/${d.id}`}
                          className="-mx-esp2 flex items-center gap-esp3 rounded-md px-esp2 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-esp2 text-sm font-medium text-texto-primario">
                              <span className="truncate">{d.numero ?? ETIQUETA_TIPO[d.tipo] ?? d.tipo}</span>
                              {d.previsto && <Insignia tono="info">Previsto</Insignia>}
                              {d.tipo === "rectificativa" && <Insignia tono="neutro">Rectificativa</Insignia>}
                            </p>
                            <p className="tabular-nums text-xs text-texto-terciario">
                              {fechaMedia(d.fecha)} · base {euros(d.resumen.baseConCoste + d.resumen.baseSinCoste)}
                              {d.resumen.lineasSinCoste > 0 && d.resumen.hayDatos ? " · parte sin coste" : ""}
                            </p>
                          </div>
                          <Cifra resumen={d.resumen} />
                        </Link>
                      </li>
                    ))
                  : margen.porProducto.slice(0, verTodo ? undefined : LIMITE).map((p) => (
                      <li key={p.clave} className="flex items-center gap-esp3 py-esp3">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-esp2 text-sm font-medium text-texto-primario">
                            <span className="truncate">{p.nombre}</span>
                            {p.libre && <Insignia tono="neutro">Concepto libre</Insignia>}
                          </p>
                          <p className="tabular-nums text-xs text-texto-terciario">
                            {formatoCantidad(p.cantidad)} {ETIQUETA_UNIDAD[p.unidad] ?? p.unidad} · facturado{" "}
                            {euros(p.resumen.baseConCoste + p.resumen.baseSinCoste)}
                          </p>
                        </div>
                        <Cifra resumen={p.resumen} />
                      </li>
                    ))}
              </ul>
              {lista.length > LIMITE && (
                <button
                  type="button"
                  onClick={() => setVerTodo((v) => !v)}
                  className="w-fit text-sm font-medium text-texto-marca hover:underline"
                >
                  {verTodo ? "Mostrar menos" : `Mostrar todos (${lista.length})`}
                </button>
              )}
              {visibles.length === 0 && (
                <p className="py-esp3 text-sm text-texto-terciario">Nada en este periodo.</p>
              )}
            </div>
          )}
        </>
      )}
    </Tarjeta>
  );
}

function Resumen({ titulo, resumen, vacio }: { titulo: string; resumen: ResumenMargen; vacio: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg bg-fondo-sutil px-esp4 py-esp3">
      <p className="text-xs font-medium text-texto-secundario">{titulo}</p>
      {resumen.hayDatos ? (
        <>
          <div className="flex flex-wrap items-center gap-esp2">
            <span className="tabular-nums text-xl font-semibold text-texto-primario">{euros(resumen.beneficio)}</span>
            <InsigniaMargen pct={resumen.pct} />
          </div>
          <p className="tabular-nums text-xs text-texto-terciario">
            Base {euros(resumen.baseConCoste)} · coste {euros(resumen.coste)}
          </p>
        </>
      ) : (
        <p className="text-sm text-texto-terciario">{vacio}</p>
      )}
    </div>
  );
}

function Cifra({ resumen }: { resumen: ResumenMargen }) {
  if (!resumen.hayDatos) return <InsigniaMargen pct={null} />;
  return (
    <div className="flex shrink-0 flex-col items-end gap-0.5">
      <span className="tabular-nums text-sm font-semibold text-texto-primario">{euros(resumen.beneficio)}</span>
      <InsigniaMargen pct={resumen.pct} />
    </div>
  );
}
