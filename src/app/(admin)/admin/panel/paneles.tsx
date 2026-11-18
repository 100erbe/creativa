"use client";

import { useState } from "react";
import Link from "next/link";
import { Pestanas } from "@/components/ui/pestanas";
import { CabeceraTarjeta } from "@/components/ui/tarjeta";
import { FilaDocumento } from "@/components/ui/fila-documento";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { clasesBoton } from "@/components/ui/boton";
import { cn } from "@/lib/cn";

// Paneles del Resumen con pestañas que filtran en el cliente (los datos llegan ya cargados).

export type DocumentoReciente = {
  id: number;
  tipo: string;
  tipoEtiqueta: string;
  numero: string;
  cliente: string | null;
  importe: string;
  estado: string;
  pago?: { texto: string; tono: "exito" | "aviso" | "peligro" | "neutro" };
};

type FiltroDoc = "todos" | "facturas" | "presupuestos";
const MAX_DOCS = 5;

export function PanelDocumentosRecientes({ documentos }: { documentos: DocumentoReciente[] }) {
  const [filtro, setFiltro] = useState<FiltroDoc>("todos");
  const lista = documentos
    .filter((d) =>
      filtro === "facturas"
        ? d.tipo === "factura" || d.tipo === "rectificativa"
        : filtro === "presupuestos"
          ? d.tipo === "presupuesto"
          : true,
    )
    .slice(0, MAX_DOCS);

  return (
    <section
      aria-labelledby="titulo-documentos-recientes"
      className="flex min-w-0 flex-1 flex-col gap-esp2 rounded-xl border border-borde-default bg-fondo-superficie p-esp2 md:p-esp4"
    >
      <div className="px-esp2">
        <CabeceraTarjeta
          id="titulo-documentos-recientes"
          titulo="Documentos recientes"
          accion={
            <Link href="/admin/documentos" className={clasesBoton("secundario")}>
              Ver todos
            </Link>
          }
        />
      </div>
      <Pestanas
        etiqueta="Tipo de documento"
        alto="alto"
        className="max-w-[396px] md:ml-0"
        valor={filtro}
        onCambio={setFiltro}
        opciones={[
          { valor: "todos", etiqueta: "Todos" },
          { valor: "facturas", etiqueta: "Facturas" },
          { valor: "presupuestos", etiqueta: "Presupuestos" },
        ]}
      />
      {lista.length > 0 ? (
        <div className="flex flex-col">
          {lista.map((d) => (
            <FilaDocumento
              key={d.id}
              href={`/admin/documentos/${d.id}`}
              cliente={d.cliente}
              numero={d.numero}
              tipo={d.tipoEtiqueta}
              importe={d.importe}
              estado={d.estado}
              pago={d.pago}
            />
          ))}
        </div>
      ) : (
        <EstadoVacio
          icono="documentos"
          titulo="No hay documentos de este tipo"
          descripcion="Los últimos documentos creados aparecerán aquí."
          accion={
            <Link href="/admin/documentos/nuevo" className={clasesBoton("primario")}>
              + Nuevo documento
            </Link>
          }
        />
      )}
    </section>
  );
}

export type CampanaResumen = {
  id: number;
  nombre: string;
  cliente: string | null;
  estado: "planificada" | "en_curso" | "finalizada" | "cancelada";
  hechos: number;
  total: number;
  incidencias: number;
};

type VistaCampanas = "activas" | "planificadas" | "cerradas";
const MAX_CAMPANAS = 4;

const VACIO: Record<VistaCampanas, { titulo: string; descripcion: string }> = {
  activas: {
    titulo: "Todo listo para tu próxima campaña",
    descripcion: "No hay campañas activas ahora. Crea una para organizar ubicaciones y seguimiento.",
  },
  planificadas: {
    titulo: "Sin campañas planificadas",
    descripcion: "Las campañas que aún no han empezado aparecerán aquí.",
  },
  cerradas: {
    titulo: "Sin campañas cerradas",
    descripcion: "Las campañas finalizadas o canceladas aparecerán aquí.",
  },
};

export function PanelCampanas({ campanas }: { campanas: CampanaResumen[] }) {
  const [vista, setVista] = useState<VistaCampanas>("activas");
  const de = (v: VistaCampanas) =>
    campanas.filter((c) =>
      v === "activas" ? c.estado === "en_curso" : v === "planificadas" ? c.estado === "planificada" : c.estado === "finalizada" || c.estado === "cancelada",
    );
  const lista = de(vista);
  const totalPuntos = de("activas").reduce((s, c) => s + c.total, 0);
  const totalIncidencias = de("activas").reduce((s, c) => s + c.incidencias, 0);

  return (
    <section
      aria-labelledby="titulo-campanas"
      className="flex w-full flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie p-esp4 md:p-esp6 xl:w-[448px] xl:shrink-0"
    >
      <CabeceraTarjeta
        id="titulo-campanas"
        titulo="Campañas"
        accion={
          <Link href="/admin/campanas?vista=pipeline" className={clasesBoton("secundario")}>
            Ver pipeline
          </Link>
        }
      />
      <Pestanas
        etiqueta="Estado de las campañas"
        alto="alto"
        valor={vista}
        onCambio={setVista}
        opciones={[
          { valor: "activas", etiqueta: "Activas", contador: de("activas").length },
          { valor: "planificadas", etiqueta: "Planificadas", contador: de("planificadas").length },
          { valor: "cerradas", etiqueta: "Cerradas", contador: de("cerradas").length },
        ]}
      />
      {lista.length > 0 ? (
        <div className="flex flex-1 flex-col divide-y divide-borde-default">
          {lista.slice(0, MAX_CAMPANAS).map((c) => {
            const pct = c.total > 0 ? Math.round((c.hechos / c.total) * 100) : 0;
            return (
              <Link
                key={c.id}
                href={`/admin/campanas/${c.id}`}
                className="-mx-esp2 flex items-center gap-esp3 rounded-lg px-esp2 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-etiqueta text-texto-primario">{c.nombre}</span>
                  <span className="block truncate text-meta font-medium text-texto-secundario">{c.cliente ?? "Sin cliente"}</span>
                  <span className="mt-esp2 flex items-center gap-esp2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-completo bg-fondo-sutil">
                      <span className="block h-full rounded-completo bg-fondo-marca" style={{ width: `${pct}%` }} />
                    </span>
                    <span className="tabular-nums text-etiqueta text-texto-secundario">
                      {c.hechos}/{c.total}
                    </span>
                  </span>
                </span>
                {c.incidencias > 0 && <Insignia tono="peligro">{c.incidencias} incid.</Insignia>}
              </Link>
            );
          })}
          {lista.length > MAX_CAMPANAS && (
            <Link href="/admin/campanas" className="pt-esp3 text-etiqueta text-texto-marca hover:underline">
              Ver las {lista.length} campañas
            </Link>
          )}
        </div>
      ) : (
        <EstadoVacio
          icono="campanas"
          className="flex-1"
          titulo={VACIO[vista].titulo}
          descripcion={VACIO[vista].descripcion}
          accion={
            vista !== "cerradas" ? (
              <Link href="/admin/campanas/nueva" className={clasesBoton("primario")}>
                + Crear campaña
              </Link>
            ) : undefined
          }
        />
      )}
      <p className={cn("text-etiqueta text-texto-secundario", totalIncidencias > 0 && "text-texto-peligro")}>
        {de("activas").length > 0
          ? `${totalPuntos} puntos en curso · ${totalIncidencias} incidencia${totalIncidencias === 1 ? "" : "s"}`
          : "Puntos e incidencias aparecerán al activar una campaña."}
      </p>
    </section>
  );
}
