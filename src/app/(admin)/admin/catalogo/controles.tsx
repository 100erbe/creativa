"use client";

import { useMemo, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { CabeceraPaginaBase } from "@/components/ui/cabecera-pagina-base";
import { Icono } from "@/components/ui/iconos";
import { Autocompletar } from "@/components/ui/autocompletar";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";
import { coincideProducto } from "./catalogo-comun";
import type { CategoriaAdmin, ProductoAdmin } from "./catalogo-comun";
import { FilaProducto } from "./fila-producto";
import { ModalProducto } from "./modal-producto";
import { ModalCategoria } from "./modal-categoria";
import { Tarjeta } from "@/components/ui/tarjeta";

export type { CategoriaAdmin, ProductoAdmin };
export type { FormatoAdmin } from "./catalogo-comun";

export function VistaCatalogo({
  categorias,
  productos,
  nuevoInicial = false,
  noLeidos = 0,
}: {
  categorias: CategoriaAdmin[];
  productos: ProductoAdmin[];
  nuevoInicial?: boolean;
  /** Avisos sin leer, para el botón «Avisos» de la cabecera. */
  noLeidos?: number;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltroId, setCategoriaFiltroId] = useState<number | null>(null);
  const [verInactivos, setVerInactivos] = useState(false);
  const [expandidoId, setExpandidoId] = useState<number | null>(null);

  const [modalProducto, setModalProducto] = useState<{ abierto: boolean; producto?: ProductoAdmin }>({
    abierto: nuevoInicial,
  });
  const [modalCategoria, setModalCategoria] = useState<{ abierto: boolean; categoria?: CategoriaAdmin }>({
    abierto: false,
  });

  const productosActivos = useMemo(() => productos.filter((p) => p.activo).length, [productos]);
  const totalFormatos = useMemo(
    () => productos.reduce((acc, p) => acc + p.formatos.filter((f) => f.activo).length, 0),
    [productos],
  );

  const conteoPorCategoria = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const p of productos) {
      if (!verInactivos && !p.activo) continue;
      mapa.set(p.categoriaId, (mapa.get(p.categoriaId) ?? 0) + 1);
    }
    return mapa;
  }, [productos, verInactivos]);

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = productos.filter((p) => {
      if (!verInactivos && !p.activo) return false;
      if (categoriaFiltroId != null && p.categoriaId !== categoriaFiltroId) return false;
      return !q || coincideProducto(p, q);
    });

    const mapa = new Map<number, { categoria: CategoriaAdmin; items: ProductoAdmin[] }>();
    for (const cat of categorias) {
      mapa.set(cat.id, { categoria: cat, items: [] });
    }
    for (const p of filtrados) {
      const grupo = mapa.get(p.categoriaId);
      if (grupo) grupo.items.push(p);
      else {
        mapa.set(p.categoriaId, {
          categoria: { id: p.categoriaId, codigo: "", nombre: p.categoriaNombre, orden: p.ordenCategoria },
          items: [p],
        });
      }
    }
    return [...mapa.values()].filter((g) => g.items.length > 0);
  }, [productos, categorias, busqueda, categoriaFiltroId, verInactivos]);

  return (
    <div className="flex flex-col gap-esp5">
      {/* Cabecera */}
      <CabeceraPaginaBase
        titulo="Catálogo de productos y servicios"
        subtitulo="Artículos, servicios, formatos y tarifas base que aparecen al crear presupuestos, albaranes y facturas. Los documentos ya creados conservan sus propios precios."
        noLeidos={noLeidos}
        acciones={
          <>
          <Boton
            variante="secundario"
            onClick={() => setModalCategoria({ abierto: true })}
          >
            <Icono nombre="mas" size={16} />
            Nueva categoría
          </Boton>
          <Boton
            disabled={categorias.length === 0}
            onClick={() => setModalProducto({ abierto: true })}
          >
            <Icono nombre="mas" size={16} />
            Nuevo producto o servicio
          </Boton>
          </>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-esp3 md:gap-esp4">
        <TarjetaKpi
          etiqueta="Productos y servicios"
          valor={String(productosActivos)}
          detalle={`${productos.length} en total`}
        />
        <TarjetaKpi
          etiqueta="Formatos activos"
          valor={String(totalFormatos)}
          detalle="Medidas estándar y alias"
        />
        <TarjetaKpi
          etiqueta="Categorías"
          valor={String(categorias.length)}
          detalle="Agrupación comercial"
        />
      </div>

      {/* Buscador y filtros */}
      <Tarjeta disposicion="libre" relleno="ninguno" className="flex flex-col gap-esp3 p-esp3 md:p-esp4">
        <div className="flex flex-wrap items-center gap-esp3">
          <Autocompletar
            value={busqueda}
            onChange={setBusqueda}
            buscar={(texto) => {
              const q = texto.toLowerCase();
              return productos
                .filter((p) => (verInactivos || p.activo) && coincideProducto(p, q))
                .slice(0, 3)
                .map((p) => ({
                  id: String(p.id),
                  titulo: p.nombre,
                  detalle: [p.codigo, p.categoriaNombre].filter(Boolean).join(" · "),
                  insignia: p.activo ? undefined : "Inactivo",
                }));
            }}
            onElegir={(s) => {
              const producto = productos.find((p) => String(p.id) === s.id);
              if (producto) setModalProducto({ abierto: true, producto });
            }}
            pie="Intro para filtrar la lista"
            retardoMs={120}
            placeholder="Buscar producto, servicio, código, formato o alias (70C…)"
            ariaLabel="Buscar en el catálogo"
            classNameContenedor="min-w-[220px] flex-1 md:max-w-md"
            className={CAMPO}
          />
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-esp2 px-esp2 text-xs text-texto-secundario md:min-h-8">
            <input
              type="checkbox"
              checked={verInactivos}
              onChange={(e) => setVerInactivos(e.target.checked)}
              className="h-4 w-4"
            />
            Ver inactivos
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-esp2 border-t border-borde-default pt-esp3">
          <button
            type="button"
            onClick={() => setCategoriaFiltroId(null)}
            aria-pressed={categoriaFiltroId === null}
            className={cn(
              "inline-flex min-h-9 items-center rounded-completo px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press md:min-h-8",
              categoriaFiltroId === null
                ? "bg-fondo-marca-sutil text-texto-marca"
                : "bg-fondo-sutil text-texto-secundario hover:bg-fondo-hover hover:text-texto-primario",
            )}
          >
            Todas
          </button>
          {categorias.map((c) => {
            const activo = categoriaFiltroId === c.id;
            const n = conteoPorCategoria.get(c.id) ?? 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategoriaFiltroId(activo ? null : c.id)}
                aria-pressed={activo}
                className={cn(
                  "inline-flex min-h-9 items-center gap-1.5 rounded-completo px-esp3 text-xs font-medium transition-colors duration-rapida ease-suave active:scale-press md:min-h-8",
                  activo
                    ? "bg-fondo-marca-sutil text-texto-marca"
                    : "bg-fondo-sutil text-texto-secundario hover:bg-fondo-hover hover:text-texto-primario",
                )}
              >
                <span>{c.nombre}</span>
                <span className={cn("tabular-nums text-micro", activo ? "opacity-80" : "text-texto-terciario")}>
                  {n}
                </span>
              </button>
            );
          })}
        </div>
      </Tarjeta>

      {/* Listado por categoría */}
      {grupos.map(({ categoria, items }) => (
        <section key={categoria.id} className="flex flex-col gap-esp2">
          <div className="flex items-center justify-between gap-esp2 px-1">
            <div className="flex items-center gap-esp2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-texto-terciario">
                {categoria.nombre}
              </h2>
              {categoria.codigo && (
                <span className="rounded bg-fondo-sutil px-1.5 py-0.5 font-mono text-micro text-texto-terciario">
                  {categoria.codigo}
                </span>
              )}
              <span className="tabular-nums text-micro text-texto-terciario">· {items.length}</span>
            </div>
            <button
              type="button"
              onClick={() => setModalCategoria({ abierto: true, categoria })}
              className="text-xs font-medium text-texto-secundario hover:text-texto-marca"
            >
              Renombrar categoría
            </button>
          </div>

          <Tarjeta disposicion="libre" relleno="ninguno" className="flex flex-col divide-y divide-borde-default overflow-hidden">
            {items.map((p) => (
              <FilaProducto
                key={`${p.id}-${p.nombre}-${p.codigo}-${p.categoriaId}-${p.unidadVenta}-${p.precioFabricacion}-${p.precioInstalacion}-${p.ivaPct}-${p.activo}-${p.permiteFabricacion}-${p.permiteInstalacion}-${p.instalableEnCampana}-${p.admiteMedidaLibre}-${p.formatos.length}`}
                producto={p}
                expandido={expandidoId === p.id}
                onAlternar={() => setExpandidoId(expandidoId === p.id ? null : p.id)}
                onEditarFicha={() => setModalProducto({ abierto: true, producto: p })}
              />
            ))}
          </Tarjeta>
        </section>
      ))}

      {grupos.length === 0 && (
        <Tarjeta disposicion="libre" relleno="ninguno" className="flex flex-col items-center gap-esp3 border-dashed px-esp5 py-esp6 text-center">
          <p className="text-sm text-texto-secundario">
            {busqueda || categoriaFiltroId != null
              ? "No hay productos o servicios con este filtro."
              : "Todavía no hay productos ni servicios en el catálogo."}
          </p>
          <Boton onClick={() => setModalProducto({ abierto: true })}>
            <Icono nombre="mas" size={16} />
            Añadir producto o servicio
          </Boton>
        </Tarjeta>
      )}

      {modalProducto.abierto && (
        <ModalProducto
          categorias={categorias}
          producto={modalProducto.producto}
          categoriaPorDefectoId={categoriaFiltroId ?? categorias[0]?.id ?? 0}
          onCerrar={() => setModalProducto({ abierto: false })}
        />
      )}

      {modalCategoria.abierto && (
        <ModalCategoria
          categoria={modalCategoria.categoria}
          onCerrar={() => setModalCategoria({ abierto: false })}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Fila de producto con edición rápida inline y gestión de formatos
// ---------------------------------------------------------------------
