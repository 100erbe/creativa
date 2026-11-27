"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Insignia } from "@/components/ui/insignia";
import { InsigniaMargen } from "@/components/ui/insignia-margen";
import { Pestanas } from "@/components/ui/pestanas";
import { CabeceraTarjeta, Tarjeta } from "@/components/ui/tarjeta";
import { cn } from "@/lib/cn";
import { formatoCantidad } from "@/lib/documento-impresion";
import { ETIQUETA_UNIDAD } from "@/lib/documentos";
import { euros } from "@/lib/formato";
import { nivelMargen, type ResumenMargen } from "@/lib/margen";
import { calcularMargenCliente } from "@/lib/margen-cliente";
import { margenPorCliente, margenPorMes, type FilaMargenGlobal } from "@/lib/margen-global";
import { BotonOjoMargenes, useMargenesVisibles } from "@/lib/margenes-visibles";

type Vista = "mes" | "cliente" | "producto";
const LIMITE = 10;
const COLOR_BARRA = { bajo: "bg-texto-peligro", medio: "bg-texto-aviso", bueno: "bg-texto-exito" } as const;

export function VistaRentabilidad({
  anio,
  filas,
  numeros,
  nombresCliente,
  nombresProducto,
}: {
  anio: number;
  filas: FilaMargenGlobal[];
  numeros: [number, string | null][];
  nombresCliente: [number, string][];
  nombresProducto: [number, string][];
}) {
  const visible = useMargenesVisibles();
  const [vista, setVista] = useState<Vista>("mes");
  const [verTodo, setVerTodo] = useState(false);

  const datos = useMemo(() => {
    const total = calcularMargenCliente(filas, {
      numeros: new Map(numeros),
      nombresProducto: new Map(nombresProducto),
    });
    return {
      total,
      meses: margenPorMes(filas, anio),
      clientes: margenPorCliente(filas, new Map(nombresCliente)),
    };
  }, [filas, numeros, nombresCliente, nombresProducto, anio]);

  const { total, meses, clientes } = datos;
  const maxMes = Math.max(...meses.map((m) => Math.abs(m.real.beneficio)), 1);

  if (!visible) {
    return (
      <Tarjeta como="section" relleno="panel" aria-label="Rentabilidad" className="gap-esp3">
        <CabeceraTarjeta titulo="Márgenes ocultos" descripcion="En este dispositivo" accion={<BotonOjoMargenes />} />
        <p className="text-sm text-texto-terciario">Pulsa el ojo para mostrar costes y márgenes.</p>
      </Tarjeta>
    );
  }

  return (
    <div className="flex flex-col gap-esp6">
      <div className="grid grid-cols-1 gap-esp3 sm:grid-cols-2 md:gap-esp4 xl:grid-cols-4">
        <Kpi titulo={`Beneficio ${anio}`} resumen={total.real} detalle="Facturas − rectificativas, con coste" />
        <Kpi titulo="Margen previsto" resumen={total.previsto} detalle="Presupuestos abiertos" />
        <div className="flex flex-col gap-1 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 md:p-esp5">
          <p className="text-sm font-medium text-texto-secundario">Coste {anio}</p>
          <p className="tabular-nums text-2xl font-bold text-texto-primario">{euros(total.real.coste)}</p>
          <p className="tabular-nums text-xs text-texto-terciario">Sobre {euros(total.real.baseConCoste)} facturados</p>
        </div>
        <div className="flex flex-col gap-1 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 md:p-esp5">
          <p className="text-sm font-medium text-texto-secundario">Facturado sin coste</p>
          <p className="tabular-nums text-2xl font-bold text-texto-primario">{euros(total.real.baseSinCoste)}</p>
          <p className="text-xs text-texto-terciario">
            {total.real.lineasSinCoste} {total.real.lineasSinCoste === 1 ? "línea" : "líneas"} fuera del cálculo ·{" "}
            <Link href="/admin/catalogo" className="font-medium text-texto-marca hover:underline">
              completar el catálogo
            </Link>
          </p>
        </div>
      </div>

      <Tarjeta como="section" relleno="panel" aria-labelledby="titulo-detalle-rentabilidad" className="gap-esp4">
        <CabeceraTarjeta
          id="titulo-detalle-rentabilidad"
          titulo={`Detalle ${anio}`}
          descripcion="Margen bruto real; el previsto se indica aparte"
          accion={<BotonOjoMargenes />}
        />
        <Pestanas
          etiqueta="Ver la rentabilidad"
          valor={vista}
          onCambio={(v) => {
            setVista(v);
            setVerTodo(false);
          }}
          opciones={[
            { valor: "mes", etiqueta: "Por mes" },
            { valor: "cliente", etiqueta: "Por cliente", contador: clientes.length },
            { valor: "producto", etiqueta: "Por producto", contador: total.porProducto.length },
          ]}
        />

        {vista === "mes" && (
          <ul className="flex flex-col divide-y divide-borde-default">
            {meses.map((m) => {
              const nivel = nivelMargen(m.real.pct);
              const ancho = m.real.hayDatos ? (Math.abs(m.real.beneficio) / maxMes) * 100 : 0;
              return (
                <li key={m.mes} className="grid grid-cols-[44px_1fr_auto] items-center gap-esp3 py-esp2">
                  <span className="text-sm font-medium text-texto-primario">{m.etiqueta}</span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="h-2 overflow-hidden rounded-completo bg-fondo-hover" role="presentation">
                      <div
                        className={cn("h-full rounded-completo", nivel ? COLOR_BARRA[nivel] : "")}
                        style={{ width: `${ancho}%` }}
                      />
                    </div>
                    <p className="tabular-nums text-xs text-texto-terciario">
                      {m.real.hayDatos
                        ? `Base ${euros(m.real.baseConCoste)} · coste ${euros(m.real.coste)}`
                        : m.real.lineasSinCoste > 0
                          ? `${euros(m.real.baseSinCoste)} facturados sin coste`
                          : "Sin facturas"}
                      {m.previsto.hayDatos ? ` · previsto ${euros(m.previsto.beneficio)}` : ""}
                    </p>
                  </div>
                  <Cifra resumen={m.real} />
                </li>
              );
            })}
          </ul>
        )}

        {vista === "cliente" && (
          <Lista
            total={clientes.length}
            verTodo={verTodo}
            onVerTodo={() => setVerTodo((v) => !v)}
            vacio="Sin facturas ni presupuestos abiertos este año."
          >
            {clientes.slice(0, verTodo ? undefined : LIMITE).map((c) => (
              <li key={c.clienteId}>
                <Link
                  href={`/admin/clientes/${c.clienteId}`}
                  className="-mx-esp2 flex items-center gap-esp3 rounded-md px-esp2 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-texto-primario">{c.nombre}</p>
                    <p className="tabular-nums text-xs text-texto-terciario">
                      Facturado {euros(c.real.baseConCoste + c.real.baseSinCoste)}
                      {c.real.lineasSinCoste > 0 && c.real.hayDatos ? " · parte sin coste" : ""}
                      {c.previsto.hayDatos ? ` · previsto ${euros(c.previsto.beneficio)}` : ""}
                    </p>
                  </div>
                  <Cifra resumen={c.real} />
                </Link>
              </li>
            ))}
          </Lista>
        )}

        {vista === "producto" && (
          <Lista
            total={total.porProducto.length}
            verTodo={verTodo}
            onVerTodo={() => setVerTodo((v) => !v)}
            vacio="Sin facturas este año."
          >
            {total.porProducto.slice(0, verTodo ? undefined : LIMITE).map((p) => (
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
          </Lista>
        )}
      </Tarjeta>
    </div>
  );
}

function Kpi({ titulo, resumen, detalle }: { titulo: string; resumen: ResumenMargen; detalle: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 md:p-esp5">
      <p className="text-sm font-medium text-texto-secundario">{titulo}</p>
      {resumen.hayDatos ? (
        <div className="flex flex-wrap items-center gap-esp2">
          <span className="tabular-nums text-2xl font-bold text-texto-primario">{euros(resumen.beneficio)}</span>
          <InsigniaMargen pct={resumen.pct} />
        </div>
      ) : (
        <p className="text-2xl font-bold text-texto-terciario">—</p>
      )}
      <p className="text-xs text-texto-terciario">{resumen.hayDatos ? detalle : "Aún sin líneas con coste"}</p>
    </div>
  );
}

function Lista({
  total,
  verTodo,
  onVerTodo,
  vacio,
  children,
}: {
  total: number;
  verTodo: boolean;
  onVerTodo: () => void;
  vacio: string;
  children: React.ReactNode;
}) {
  if (total === 0) return <p className="py-esp3 text-sm text-texto-terciario">{vacio}</p>;
  return (
    <div className="flex flex-col gap-esp2">
      <ul className="flex flex-col divide-y divide-borde-default">{children}</ul>
      {total > LIMITE && (
        <button type="button" onClick={onVerTodo} className="w-fit text-sm font-medium text-texto-marca hover:underline">
          {verTodo ? "Mostrar menos" : `Mostrar todos (${total})`}
        </button>
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
