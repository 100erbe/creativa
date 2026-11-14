"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { Boton } from "@/components/ui/boton";
import { Campo } from "@/components/ui/campo";
import { Icono } from "@/components/ui/iconos";
import { euros } from "@/lib/formato";
import { anadirLineaRapida, eliminarLinea } from "./acciones";

type Documento = {
  id: number;
  cliente_id: number;
  cliente_razon_social: string | null;
  suma_lineas: number;
  base_imponible: number;
  cuota_iva: number;
  total: number;
  forma_pago_id: number | null;
  texto_forma_pago: string | null;
};

type Linea = {
  id: number;
  descripcion: string;
  piezas: number;
  unidad: string;
  precio_unitario: number;
  descuento_pct: number;
  importe: number;
};

type Plantilla = {
  id: number;
  nombre: string;
  producto_id: number;
  formato_id: number | null;
  alcance: "fabricacion" | "instalacion" | "fabricacion_instalacion";
  piezas_sugeridas: number;
};

type Reciente = {
  producto_id: number;
  producto: string;
  formato_id: number | null;
  formato: string | null;
  alcance: string;
  ultimo_precio: number;
  usado_en: string;
};

export function PasoLineas({
  documento,
  lineas,
  plantillas,
  recientes,
}: {
  documento: Documento;
  lineas: Linea[];
  plantillas: Plantilla[];
  recientes: Reciente[];
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [idEnCurso, setIdEnCurso] = useState<number | null>(null);

  function anadirDesdePlantilla(p: Plantilla) {
    iniciar(async () => {
      await anadirLineaRapida({
        documentoId: documento.id,
        clienteId: documento.cliente_id,
        productoId: p.producto_id,
        formatoId: p.formato_id,
        alcance: p.alcance,
        piezas: p.piezas_sugeridas,
      });
      router.refresh();
    });
  }

  function anadirDesdeReciente(r: Reciente) {
    iniciar(async () => {
      await anadirLineaRapida({
        documentoId: documento.id,
        clienteId: documento.cliente_id,
        productoId: r.producto_id,
        formatoId: r.formato_id,
        alcance: r.alcance as Plantilla["alcance"],
      });
      router.refresh();
    });
  }

  function borrar(id: number) {
    setIdEnCurso(id);
    iniciar(async () => {
      await eliminarLinea(id);
      setIdEnCurso(null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-esp5">
      <div className="flex items-center gap-esp3">
        <div className="flex-1">
          <p className="text-xs text-texto-terciario">Documentos / Nuevo</p>
          <h1 className="text-2xl font-semibold text-texto-primario">Nuevo presupuesto</h1>
        </div>
        <Boton variante="secundario">Guardar borrador</Boton>
      </div>

      <PasosDocumento actual={2} />

      <div className="flex flex-col gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4">
          {/* Cliente (compacto) */}
          <div className="flex items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-fondo-marca-sutil text-sm font-medium text-texto-marca">
              {documento.cliente_razon_social?.slice(0, 2).toUpperCase() ?? "CL"}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-texto-primario">
                {documento.cliente_razon_social}
              </p>
            </div>
            <button className="text-sm font-medium text-texto-marca">Cambiar</button>
          </div>

          {/* Añadir línea rápida */}
          <div className="flex flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
            <div>
              <h2 className="text-base font-semibold text-texto-primario">Añadir línea</h2>
              <p className="text-sm text-texto-secundario">
                Elige un paquete o repite algo que ya le hiciste a este cliente. El precio se
                calcula solo con su tarifa.
              </p>
            </div>

            {plantillas.length > 0 && (
              <div className="flex flex-wrap gap-esp2">
                {plantillas.map((p) => (
                  <button
                    key={p.id}
                    disabled={pendiente}
                    onClick={() => anadirDesdePlantilla(p)}
                    className="flex items-center gap-1 rounded-completo border border-borde-fuerte bg-fondo-superficie px-esp3 py-1.5 text-sm font-medium text-texto-primario disabled:opacity-50"
                  >
                    <Icono nombre="mas" size={14} className="text-icono-marca" />
                    {p.nombre}
                  </button>
                ))}
              </div>
            )}

            {recientes.length > 0 && (
              <>
                <div className="flex items-center gap-esp2">
                  <Icono nombre="reloj" size={16} className="text-icono-secundario" />
                  <span className="text-xs font-medium text-texto-terciario">
                    USADO RECIENTEMENTE CON ESTE CLIENTE
                  </span>
                </div>
                {recientes.map((r, i) => (
                  <div
                    key={`${r.producto_id}-${r.formato_id}-${i}`}
                    className="flex items-center gap-esp3 rounded-md bg-fondo-sutil px-esp3 py-esp2"
                  >
                    <div className="flex-1">
                      <p className="text-sm font-medium text-texto-primario">
                        {r.producto} {r.formato ? `· ${r.formato}` : ""}
                      </p>
                      <p className="text-xs text-texto-terciario">
                        Último precio: {euros(Number(r.ultimo_precio))}
                      </p>
                    </div>
                    <span className="text-sm font-medium text-texto-primario">
                      {euros(Number(r.ultimo_precio))}
                    </span>
                    <Boton
                      tamano="s"
                      variante="secundario"
                      disabled={pendiente}
                      onClick={() => anadirDesdeReciente(r)}
                    >
                      Añadir
                    </Boton>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Líneas */}
          <div className="flex flex-col gap-esp3 overflow-x-auto rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
            <h2 className="text-base font-semibold text-texto-primario">
              Líneas del presupuesto · {lineas.length}
            </h2>
            <div className="grid min-w-[560px] grid-cols-[1fr_60px_100px_60px_110px_20px] gap-esp4 text-xs font-medium text-texto-terciario">
              <span>CONCEPTO</span>
              <span className="text-right">CANT.</span>
              <span className="text-right">PRECIO</span>
              <span className="text-right">DTO.</span>
              <span className="text-right">IMPORTE</span>
              <span />
            </div>
            <div className="flex min-w-[560px] flex-col divide-y divide-fondo-hover">
              {lineas.map((l) => (
                <div
                  key={l.id}
                  className="grid grid-cols-[1fr_60px_100px_60px_110px_20px] items-center gap-esp4 py-esp3"
                >
                  <p className="text-sm font-medium text-texto-primario">{l.descripcion}</p>
                  <span className="text-right text-sm text-texto-primario">
                    {l.piezas} {l.unidad}
                  </span>
                  <span className="text-right text-sm text-texto-primario">
                    {euros(Number(l.precio_unitario))}
                  </span>
                  <span className="text-right text-sm text-texto-secundario">
                    {l.descuento_pct > 0 ? `${l.descuento_pct}%` : "—"}
                  </span>
                  <span className="text-right text-sm font-medium text-texto-primario">
                    {euros(Number(l.importe))}
                  </span>
                  <button
                    disabled={pendiente && idEnCurso === l.id}
                    onClick={() => borrar(l.id)}
                    aria-label="Eliminar línea"
                    className="text-icono-secundario hover:text-texto-peligro"
                  >
                    <Icono nombre="eliminar" size={16} />
                  </button>
                </div>
              ))}
              {lineas.length === 0 && (
                <p className="py-esp4 text-sm text-texto-terciario">
                  Todavía no has añadido ninguna línea.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Resumen */}
        <div className="flex w-full shrink-0 flex-col gap-esp4 xl:w-[360px]">
          <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
            <h2 className="text-base font-semibold text-texto-primario">Resumen</h2>
            <Fila etiqueta="Base imponible" valor={euros(Number(documento.base_imponible))} />
            <Fila etiqueta="IVA" valor={euros(Number(documento.cuota_iva))} />
            <div className="h-px bg-fondo-hover" />
            <div className="flex items-center">
              <span className="flex-1 text-base font-semibold text-texto-primario">Total</span>
              <span className="text-[28px] font-semibold leading-9 text-texto-primario">
                {euros(Number(documento.total))}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-esp2 rounded-md bg-fondo-info-sutil px-esp4 py-esp3">
            <Icono nombre="copiar" size={16} className="text-icono-default" />
            <p className="text-xs text-texto-info">
              ¿Se parece a uno anterior? Duplícalo desde Documentos y solo cambia lo necesario.
            </p>
          </div>

          <div className="mt-auto flex gap-esp3">
            <Boton variante="secundario" onClick={() => router.push("/admin/documentos/nuevo")}>
              Atrás
            </Boton>
            <Boton
              className="flex-1"
              disabled={lineas.length === 0}
              onClick={() => router.push(`/admin/documentos/${documento.id}`)}
            >
              Continuar
            </Boton>
          </div>
        </div>
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-sm text-texto-secundario">{etiqueta}</span>
      <span className="text-sm font-medium text-texto-primario">{valor}</span>
    </div>
  );
}
