"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { BotonSalirBorrador } from "@/components/admin/boton-salir-borrador";
import { Boton } from "@/components/ui/boton";
import { BarraAccion } from "@/components/ui/panel-busqueda";
import { euros } from "@/lib/formato";
import { ETIQUETA_TIPO } from "@/lib/documentos";
import { texto, Fila } from "./lineas-comun";
import type { Cabecera, SituacionCliente, Linea, ProductoCatalogo, CategoriaOpcion, Reciente } from "./lineas-comun";
import { TarjetaSituacionCliente } from "./tarjeta-situacion-cliente";
import { ListaCompacta, TablaLineas } from "./tabla-lineas";
import { FormularioArticulo } from "./formulario-articulo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { BloqueMargen } from "@/components/ui/bloque-margen";
import { resumirMargen } from "@/lib/margen";

export type { Cabecera, SituacionCliente, ProductoCatalogo, CategoriaOpcion };
export type { FormatoCatalogo } from "./lineas-comun";

export function PasoLineas({
  documento,
  situacionCliente,
  lineas,
  catalogo,
  categorias,
  recientes,
}: {
  documento: Cabecera;
  situacionCliente: SituacionCliente;
  lineas: Linea[];
  catalogo: ProductoCatalogo[];
  categorias: CategoriaOpcion[];
  recientes: Reciente[];
}) {
  const router = useRouter();
  const etiquetaTipo = ETIQUETA_TIPO[documento.tipo] ?? "Documento";

  const recientesVisibles = recientes
    .map((r) => {
      const p = catalogo.find((c) => c.id === r.producto_id);
      const f = p?.formatos.find((x) => x.id === r.formato_id);
      return p ? { ...r, etiqueta: `${p.nombre}${f ? ` · ${f.nombre}` : ""}` } : null;
    })
    .filter((r): r is Reciente & { etiqueta: string } => r !== null);

  return (
    <div className="flex flex-col gap-esp5">
      <div className="flex flex-wrap items-center gap-esp3">
        <div className="flex-1">
          <p className="text-xs text-texto-terciario">Documentos / Nuevo</p>
          <h1 className="text-2xl font-bold text-texto-primario md:text-titulo-pagina">
            {etiquetaTipo} en borrador
          </h1>
        </div>
        <BotonSalirBorrador documentoId={documento.id} />
      </div>

      <PasosDocumento actual={2} documentoId={documento.id} />

      <div className="flex flex-col gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4">
          {/* Cliente (compacto) */}
          <Tarjeta disposicion="libre" relleno="ninguno" className="flex items-center gap-esp3 px-esp5 py-esp3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fondo-marca-sutil text-sm font-medium text-texto-marca">
              {documento.cliente.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-texto-primario">{documento.cliente}</p>
              {documento.descuento_habitual > 0 && (
                <p className="text-xs text-texto-terciario">
                  Descuento habitual: {texto(documento.descuento_habitual)} %
                </p>
              )}
            </div>
            <Link
              href={`/admin/documentos/nuevo?documento=${documento.id}&paso=cliente`}
              className="text-sm font-medium text-texto-marca"
            >
              Cambiar
            </Link>
          </Tarjeta>

          {/* Situación financiera del cliente (formato compacto en móvil/tablet). */}
          <div className="xl:hidden">
            <TarjetaSituacionCliente clienteId={documento.cliente_id} situacion={situacionCliente} compacta />
          </div>

          {/* En pantallas estrechas el resumen queda abajo: lista compacta sobre el formulario. */}
          {lineas.length > 0 && (
            <Tarjeta disposicion="libre" relleno="ninguno" className="px-esp4 py-esp3 xl:hidden">
              <ListaCompacta lineas={lineas} />
            </Tarjeta>
          )}

          <FormularioArticulo
            documento={documento}
            catalogo={catalogo}
            categorias={categorias}
            artistas={[...new Set(lineas.map((l) => l.artista).filter((a): a is string => !!a))]}
            recientes={recientesVisibles}
            onAnadido={() => router.refresh()}
          />

          <TablaLineas documentoId={documento.id} lineas={lineas} descuentoGlobalPct={documento.descuento_global_pct} />
        </div>

        {/* Resumen + situación del cliente */}
        <div className="flex w-full shrink-0 flex-col gap-esp4 xl:w-[340px] xl:sticky xl:top-esp5 xl:self-start">
          <Tarjeta disposicion="libre" relleno="ninguno" className="flex flex-col gap-esp3 px-esp6 py-esp5">
            <h2 className="text-titulo-panel text-texto-primario">Resumen</h2>
            {lineas.length > 0 && (
              <div className="hidden xl:block">
                <ListaCompacta lineas={lineas} />
              </div>
            )}
            <Fila etiqueta={`Artículos (${lineas.length})`} valor={euros(documento.suma_lineas)} />
            <Fila etiqueta="Base imponible" valor={euros(documento.base_imponible)} />
            <Fila etiqueta="IVA" valor={euros(documento.cuota_iva)} />
            <div className="h-px bg-fondo-hover" />
            <div className="flex items-center">
              <span className="flex-1 text-base font-semibold text-texto-primario">Total</span>
              <span className="whitespace-nowrap text-[clamp(1.375rem,7vw,1.75rem)] font-semibold leading-9 text-texto-primario">
                {euros(documento.total)}
              </span>
            </div>
            {lineas.length > 0 && (
              <BloqueMargen
                resumen={resumirMargen(lineas, documento.descuento_global_pct)}
                previsto={documento.tipo === "presupuesto"}
              />
            )}
            <BarraAccion className="md:mt-esp2">
              <div className="min-w-0 md:hidden">
                <p className="text-xs text-texto-terciario">Total</p>
                <p className="text-lg font-semibold leading-tight text-texto-primario">{euros(documento.total)}</p>
              </div>
              <Boton
                variante="secundario"
                className="ml-auto md:ml-0"
                onClick={() => router.push(`/admin/documentos/nuevo?documento=${documento.id}&paso=cliente`)}
              >
                Atrás
              </Boton>
              <Boton
                className="md:flex-1"
                disabled={lineas.length === 0}
                onClick={() => router.push(`/admin/documentos/nuevo?documento=${documento.id}&paso=campana`)}
              >
                Continuar
              </Boton>
            </BarraAccion>
            {lineas.length === 0 && (
              <p className="text-xs text-texto-terciario">Añade al menos un artículo para continuar.</p>
            )}
          </Tarjeta>

          <div className="hidden xl:block">
            <TarjetaSituacionCliente clienteId={documento.cliente_id} situacion={situacionCliente} />
          </div>
        </div>
      </div>
    </div>
  );
}
