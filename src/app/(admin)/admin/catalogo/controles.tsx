"use client";

import { useEffect, useMemo, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { CabeceraPaginaBase } from "@/components/ui/cabecera-pagina-base";
import { Icono } from "@/components/ui/iconos";
import { Autocompletar } from "@/components/ui/autocompletar";
import { Insignia } from "@/components/ui/insignia";
import { TarjetaKpi } from "@/components/ui/tarjeta-kpi";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { confirmar } from "@/components/ui/dialogos";
import { cn } from "@/lib/cn";
import { desenvolver } from "@/lib/accion";
import { euros } from "@/lib/formato";
import { useAccion } from "@/lib/use-accion";
import {
  eliminarFormato,
  eliminarProducto,
  guardarCategoria,
  guardarFormato,
  guardarProducto,
} from "./acciones";
import { atraparFoco } from "@/lib/trampa-foco";

export type CategoriaAdmin = {
  id: number;
  codigo: string;
  nombre: string;
  orden: number;
};

export type FormatoAdmin = {
  id: number;
  codigo: string;
  nombre: string;
  anchoCm: number | null;
  altoCm: number | null;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  alias: string[];
  activo: boolean;
};

export type ProductoAdmin = {
  id: number;
  codigo: string;
  categoriaId: number;
  categoriaNombre: string;
  ordenCategoria: number;
  nombre: string;
  descripcionFactura: string | null;
  material: string | null;
  unidadVenta: string;
  admiteMedidaLibre: boolean;
  permiteFabricacion: boolean;
  permiteInstalacion: boolean;
  instalableEnCampana: boolean;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  pedidoMinimo: number | null;
  ivaPct: number;
  activo: boolean;
  notas: string | null;
  formatos: FormatoAdmin[];
};

const UNIDAD_CORTA: Record<string, string> = {
  ud: "ud",
  m2: "m²",
  ml: "ml",
  millar: "millar",
  mes: "mes",
  servicio: "servicio",
  km: "km",
};

const UNIDADES_OPCIONES = [
  { valor: "ud", etiqueta: "Unidad (ud)" },
  { valor: "m2", etiqueta: "Metro cuadrado (m²)" },
  { valor: "ml", etiqueta: "Metro lineal (ml)" },
  { valor: "millar", etiqueta: "Millar (1.000 uds)" },
  { valor: "mes", etiqueta: "Mes (alquiler)" },
  { valor: "servicio", etiqueta: "Servicio / tarifa plana" },
  { valor: "km", etiqueta: "Kilómetro (km)" },
];

const IVAS = [21, 10, 4, 0];

/** "12,5" → 12.5; vacío → null; texto inválido → NaN */
function aNumero(v: string): number | null {
  const t = v.trim().replace(/\s|€/g, "");
  if (t === "") return null;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}

const aTexto = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

const etiquetaMini = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";

/** ¿El producto coincide con la búsqueda (q ya en minúsculas)? Nombre, código, categoría, descripción, material, formatos y alias. */
function coincideProducto(p: ProductoAdmin, q: string) {
  const textoFormatos = p.formatos.map((f) => `${f.nombre} ${f.codigo} ${f.alias.join(" ")}`).join(" ");
  return `${p.nombre} ${p.codigo} ${p.categoriaNombre} ${p.descripcionFactura ?? ""} ${p.material ?? ""} ${textoFormatos}`
    .toLowerCase()
    .includes(q);
}

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
      <div className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-superficie p-esp3 md:p-esp4">
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
      </div>

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

          <div className="flex flex-col divide-y divide-borde-default overflow-hidden rounded-xl border border-borde-default bg-fondo-superficie">
            {items.map((p) => (
              <FilaProducto
                key={`${p.id}-${p.nombre}-${p.codigo}-${p.categoriaId}-${p.unidadVenta}-${p.precioFabricacion}-${p.precioInstalacion}-${p.ivaPct}-${p.activo}-${p.permiteFabricacion}-${p.permiteInstalacion}-${p.instalableEnCampana}-${p.admiteMedidaLibre}-${p.formatos.length}`}
                producto={p}
                expandido={expandidoId === p.id}
                onAlternar={() => setExpandidoId(expandidoId === p.id ? null : p.id)}
                onEditarFicha={() => setModalProducto({ abierto: true, producto: p })}
              />
            ))}
          </div>
        </section>
      ))}

      {grupos.length === 0 && (
        <div className="flex flex-col items-center gap-esp3 rounded-xl border border-dashed border-borde-default bg-fondo-superficie px-esp5 py-esp6 text-center">
          <p className="text-sm text-texto-secundario">
            {busqueda || categoriaFiltroId != null
              ? "No hay productos o servicios con este filtro."
              : "Todavía no hay productos ni servicios en el catálogo."}
          </p>
          <Boton onClick={() => setModalProducto({ abierto: true })}>
            <Icono nombre="mas" size={16} />
            Añadir producto o servicio
          </Boton>
        </div>
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

function FilaProducto({
  producto: p,
  expandido,
  onAlternar,
  onEditarFicha,
}: {
  producto: ProductoAdmin;
  expandido: boolean;
  onAlternar: () => void;
  onEditarFicha: () => void;
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });
  const [guardado, setGuardado] = useState(false);
  const [fab, setFab] = useState(aTexto(p.precioFabricacion));
  const [inst, setInst] = useState(aTexto(p.precioInstalacion));
  const [iva, setIva] = useState(String(p.ivaPct));
  const [activo, setActivo] = useState(p.activo);
  const [nuevoFormato, setNuevoFormato] = useState(false);

  const unidad = UNIDAD_CORTA[p.unidadVenta] ?? p.unidadVenta;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-esp3 px-esp4 py-esp3 transition-colors duration-rapida ease-suave hover:bg-fondo-sutil/60 md:px-esp5">
        <button
          type="button"
          onClick={onAlternar}
          aria-expanded={expandido}
          className="flex min-w-0 flex-1 items-center gap-esp3 text-left"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-esp2">
              <p className={cn("truncate text-sm font-medium", p.activo ? "text-texto-primario" : "text-texto-terciario")}>
                {p.nombre}
              </p>
              {!p.activo && <Insignia tono="neutro">Inactivo</Insignia>}
              {p.admiteMedidaLibre && (
                <span className="rounded bg-fondo-marca-sutil px-1.5 py-0.5 text-micro font-medium text-texto-marca">
                  A medida
                </span>
              )}
            </div>
            <p className="truncate text-xs text-texto-terciario">
              <span className="font-mono">{p.codigo}</span> · por {unidad}
              {p.permiteFabricacion && p.permiteInstalacion
                ? " · Fab. + Inst."
                : p.permiteFabricacion
                  ? " · Solo fab."
                  : " · Solo inst."}
              {!p.instalableEnCampana ? " · No instalable en campañas" : ""}
              {p.formatos.length > 0 ? ` · ${p.formatos.length} formato${p.formatos.length === 1 ? "" : "s"}` : ""}
              {p.descripcionFactura ? ` · ${p.descripcionFactura}` : ""}
            </p>
          </div>
        </button>

        <div className="tabular-nums hidden items-center gap-esp2 text-xs text-texto-secundario sm:flex">
          {p.permiteFabricacion && (
            <span className="rounded bg-fondo-sutil px-2 py-0.5">
              Fab. <strong className="text-texto-primario">{p.precioFabricacion != null ? euros(p.precioFabricacion) : "—"}</strong>
            </span>
          )}
          {p.permiteInstalacion && (
            <span className="rounded bg-fondo-sutil px-2 py-0.5">
              Inst. <strong className="text-texto-primario">{p.precioInstalacion != null ? euros(p.precioInstalacion) : "—"}</strong>
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-esp2">
          <button
            type="button"
            onClick={onEditarFicha}
            className="inline-flex min-h-8 items-center rounded-md border border-borde-default px-esp2 text-xs font-medium text-texto-primario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
          >
            Editar
          </button>
          <button
            type="button"
            onClick={onAlternar}
            className="inline-flex min-h-8 items-center gap-1 rounded-md px-esp2 text-xs font-medium text-texto-marca transition-colors duration-rapida ease-suave hover:bg-fondo-marca-sutil active:scale-press"
          >
            {expandido ? "Cerrar" : p.formatos.length > 0 ? `Formatos (${p.formatos.length})` : "Precios / Formatos"}
          </button>
        </div>
      </div>

      {expandido && (
        <div className="animate-estado-entrar flex flex-col gap-esp4 border-t border-borde-default bg-fondo-sutil/70 px-esp4 py-esp4 md:px-esp5">
          {/* Ajuste rápido de precios y estado */}
          <form
            className="flex flex-col gap-esp3 rounded-md border border-borde-default bg-fondo-superficie p-esp3"
            onSubmit={(e) => {
              e.preventDefault();
              setGuardado(false);
              const nFab = p.permiteFabricacion ? aNumero(fab) : null;
              const nInst = p.permiteInstalacion ? aNumero(inst) : null;
              if (nFab != null && !Number.isFinite(nFab)) return setError("Precio de fabricación no válido.");
              if (nInst != null && !Number.isFinite(nInst)) return setError("Precio de instalación no válido.");
              ejecutar(async () => {
                await desenvolver(
                  guardarProducto(p.id, {
                    codigo: p.codigo,
                    categoriaId: p.categoriaId,
                    nombre: p.nombre,
                    descripcionFactura: p.descripcionFactura ?? undefined,
                    material: p.material ?? undefined,
                    unidadVenta: p.unidadVenta,
                    admiteMedidaLibre: p.admiteMedidaLibre,
                    permiteFabricacion: p.permiteFabricacion,
                    permiteInstalacion: p.permiteInstalacion,
                    instalableEnCampana: p.instalableEnCampana,
                    precioFabricacion: nFab,
                    precioInstalacion: nInst,
                    pedidoMinimo: p.pedidoMinimo,
                    ivaPct: Number(iva),
                    activo,
                    notas: p.notas ?? undefined,
                  }),
                );
                setGuardado(true);
              });
            }}
          >
            <div className="flex flex-wrap items-center justify-between gap-esp2">
              <p className="text-xs font-semibold uppercase tracking-wide text-texto-terciario">
                Ajuste rápido de precios
              </p>
              <button
                type="button"
                onClick={onEditarFicha}
                className="text-xs font-medium text-texto-marca hover:underline"
              >
                Editar ficha completa (nombre, descripción, unidad, alcance…)
              </button>
            </div>
            <div className="grid grid-cols-2 gap-esp3 sm:grid-cols-4">
              {p.permiteFabricacion && (
                <label className={etiquetaMini}>
                  Fabricación (€/{unidad})
                  <input value={fab} onChange={(e) => setFab(e.target.value)} inputMode="decimal" className={CAMPO} />
                </label>
              )}
              {p.permiteInstalacion && (
                <label className={etiquetaMini}>
                  Instalación (€/{unidad})
                  <input value={inst} onChange={(e) => setInst(e.target.value)} inputMode="decimal" className={CAMPO} />
                </label>
              )}
              <label className={etiquetaMini}>
                IVA
                <select value={iva} onChange={(e) => setIva(e.target.value)} className={CAMPO}>
                  {IVAS.map((v) => (
                    <option key={v} value={v}>
                      {v} %
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-end gap-esp2 pb-2 text-sm text-texto-primario">
                <input
                  type="checkbox"
                  checked={activo}
                  onChange={(e) => setActivo(e.target.checked)}
                  className="h-4 w-4"
                />
                Activo
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-esp3">
              <Boton type="submit" tamano="s" cargando={pendiente}>
                Guardar precios
              </Boton>
              {guardado && !error && <span className="animate-estado-entrar text-xs text-texto-exito">Guardado</span>}
              {error && <span className="text-xs text-texto-peligro">{error}</span>}
            </div>
          </form>

          {/* Formatos */}
          <div className="flex flex-col gap-esp2">
            <div className="flex flex-wrap items-center justify-between gap-esp2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-texto-terciario">
                Formatos y medidas ({p.formatos.length}) · vacío = usa precio del producto
              </h3>
              {!nuevoFormato && (
                <Boton
                  type="button"
                  tamano="s"
                  variante="secundario"
                  onClick={() => setNuevoFormato(true)}
                >
                  <Icono nombre="mas" size={14} />
                  Añadir formato
                </Boton>
              )}
            </div>

            {nuevoFormato && (
              <FormularioFormato
                productoId={p.id}
                unidad={unidad}
                permiteFab={p.permiteFabricacion}
                permiteInst={p.permiteInstalacion}
                onCerrar={() => setNuevoFormato(false)}
              />
            )}

            {p.formatos.map((f) => (
              <FormularioFormato
                key={`${f.id}-${f.codigo}-${f.nombre}-${f.anchoCm}-${f.altoCm}-${f.precioFabricacion}-${f.precioInstalacion}-${f.alias.join(",")}-${f.activo}`}
                productoId={p.id}
                formato={f}
                unidad={unidad}
                permiteFab={p.permiteFabricacion}
                permiteInst={p.permiteInstalacion}
              />
            ))}

            {p.formatos.length === 0 && !nuevoFormato && (
              <p className="text-xs text-texto-terciario">
                Sin formatos fijos. Puedes añadir medidas estándar con precio propio y alias de búsqueda (ej. «70C»,
                «MAXI»).
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Formulario de formato (alta y edición)
// ---------------------------------------------------------------------

function FormularioFormato({
  productoId,
  formato: f,
  unidad,
  permiteFab,
  permiteInst,
  onCerrar,
}: {
  productoId: number;
  formato?: FormatoAdmin;
  unidad: string;
  permiteFab: boolean;
  permiteInst: boolean;
  onCerrar?: () => void;
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });
  const [guardado, setGuardado] = useState(false);
  const [editando, setEditando] = useState(!f);
  const [nombre, setNombre] = useState(f?.nombre ?? "");
  const [codigo, setCodigo] = useState(f?.codigo ?? "");
  const [ancho, setAncho] = useState(aTexto(f?.anchoCm ?? null));
  const [alto, setAlto] = useState(aTexto(f?.altoCm ?? null));
  const [fab, setFab] = useState(aTexto(f?.precioFabricacion ?? null));
  const [inst, setInst] = useState(aTexto(f?.precioInstalacion ?? null));
  const [alias, setAlias] = useState(f?.alias.join(", ") ?? "");
  const [activo, setActivo] = useState(f?.activo ?? true);

  if (f && !editando) {
    return (
      <div className="flex flex-wrap items-center gap-esp3 rounded-md border border-borde-default bg-fondo-superficie px-esp3 py-esp2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-esp2">
            <span className={cn("text-sm font-medium", f.activo ? "text-texto-primario" : "text-texto-terciario")}>
              {f.nombre}
            </span>
            <span className="font-mono text-micro text-texto-terciario">{f.codigo}</span>
            {!f.activo && <Insignia tono="neutro">Inactivo</Insignia>}
          </div>
          <p className="text-xs text-texto-terciario">
            {f.anchoCm != null && f.altoCm != null ? `${aTexto(f.anchoCm)} × ${aTexto(f.altoCm)} cm` : "Sin medidas fijas"}
            {f.alias.length > 0 ? ` · Alias: ${f.alias.join(", ")}` : ""}
          </p>
        </div>
        <div className="tabular-nums flex flex-wrap items-center gap-esp2 text-xs text-texto-secundario">
          {permiteFab && (
            <span className="rounded bg-fondo-sutil px-2 py-0.5">
              Fab. {f.precioFabricacion != null ? euros(f.precioFabricacion) : "base"}
            </span>
          )}
          {permiteInst && (
            <span className="rounded bg-fondo-sutil px-2 py-0.5">
              Inst. {f.precioInstalacion != null ? euros(f.precioInstalacion) : "base"}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-xs font-medium text-texto-marca hover:underline"
        >
          Editar
        </button>
      </div>
    );
  }

  return (
    <form
      className={cn(
        "animate-estado-entrar flex flex-col gap-esp3 rounded-md border bg-fondo-superficie p-esp3",
        f ? "border-borde-foco" : "border-borde-marca bg-fondo-marca-sutil/20",
      )}
      onSubmit={(e) => {
        e.preventDefault();
        setGuardado(false);
        const nAncho = aNumero(ancho);
        const nAlto = aNumero(alto);
        const nFab = permiteFab ? aNumero(fab) : null;
        const nInst = permiteInst ? aNumero(inst) : null;
        if (nAncho != null && !Number.isFinite(nAncho)) return setError("Ancho no válido.");
        if (nAlto != null && !Number.isFinite(nAlto)) return setError("Alto no válido.");
        if (nFab != null && !Number.isFinite(nFab)) return setError("Precio de fabricación no válido.");
        if (nInst != null && !Number.isFinite(nInst)) return setError("Precio de instalación no válido.");

        ejecutar(async () => {
          await desenvolver(
            guardarFormato(f?.id ?? null, {
              productoId,
              codigo,
              nombre,
              anchoCm: nAncho,
              altoCm: nAlto,
              precioFabricacion: nFab,
              precioInstalacion: nInst,
              alias,
              activo,
            }),
          );
          setGuardado(true);
          if (onCerrar) onCerrar();
          else setEditando(false);
        });
      }}
    >
      <div className="grid grid-cols-1 gap-esp2 sm:grid-cols-[2fr_1fr_90px_90px]">
        <label className={etiquetaMini}>
          Nombre del formato *
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Cartel 70x100"
            required
            className={CAMPO}
          />
        </label>
        <label className={etiquetaMini}>
          Código
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder={f ? "" : "Auto (ej. 70x100)"}
            className={CAMPO}
          />
        </label>
        <label className={etiquetaMini}>
          Ancho (cm)
          <input value={ancho} onChange={(e) => setAncho(e.target.value)} inputMode="decimal" className={CAMPO} />
        </label>
        <label className={etiquetaMini}>
          Alto (cm)
          <input value={alto} onChange={(e) => setAlto(e.target.value)} inputMode="decimal" className={CAMPO} />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-esp2 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
        {permiteFab && (
          <label className={etiquetaMini}>
            Fab. (€/{unidad})
            <input
              value={fab}
              onChange={(e) => setFab(e.target.value)}
              inputMode="decimal"
              placeholder="Base producto"
              className={CAMPO}
            />
          </label>
        )}
        {permiteInst && (
          <label className={etiquetaMini}>
            Inst. (€/{unidad})
            <input
              value={inst}
              onChange={(e) => setInst(e.target.value)}
              inputMode="decimal"
              placeholder="Base producto"
              className={CAMPO}
            />
          </label>
        )}
        <label className={etiquetaMini}>
          Alias de búsqueda rápida (separados por coma)
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="Ej. 70C, cartel grande"
            className={CAMPO}
          />
        </label>
        <label className="flex items-end gap-esp2 pb-2 text-sm text-texto-primario">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="h-4 w-4" />
          Activo
        </label>
      </div>

      {error && <p className="text-xs text-texto-peligro">{error}</p>}
      <div className="flex flex-wrap items-center gap-esp2">
        <Boton type="submit" tamano="s" cargando={pendiente}>
          {f ? "Guardar formato" : "Añadir formato"}
        </Boton>
        <Boton
          type="button"
          tamano="s"
          variante="secundario"
          disabled={pendiente}
          onClick={() => {
            if (onCerrar) onCerrar();
            else setEditando(false);
          }}
        >
          Cancelar
        </Boton>
        {guardado && !error && <span className="animate-estado-entrar text-xs text-texto-exito">Guardado</span>}
        {f && (
          <button
            type="button"
            disabled={pendiente}
            onClick={async () => {
              if (!(await confirmar(`¿Eliminar el formato «${f.nombre}»?`))) return;
              ejecutar(() => desenvolver(eliminarFormato(f.id)));
            }}
            className="ml-auto text-xs font-medium text-texto-secundario hover:text-texto-peligro disabled:opacity-50"
          >
            Eliminar
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------
//  Modal de creación / edición completa de Producto o Servicio
// ---------------------------------------------------------------------

function ModalProducto({
  categorias,
  producto: p,
  categoriaPorDefectoId,
  onCerrar,
}: {
  categorias: CategoriaAdmin[];
  producto?: ProductoAdmin;
  categoriaPorDefectoId: number;
  onCerrar: () => void;
}) {
  const { pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });

  const [nombre, setNombre] = useState(p?.nombre ?? "");
  const [categoriaId, setCategoriaId] = useState(String(p?.categoriaId ?? categoriaPorDefectoId));
  const [codigo, setCodigo] = useState(p?.codigo ?? "");
  const [unidadVenta, setUnidadVenta] = useState(p?.unidadVenta ?? "ud");
  const [permiteFabricacion, setPermiteFabricacion] = useState(p?.permiteFabricacion ?? true);
  const [permiteInstalacion, setPermiteInstalacion] = useState(p?.permiteInstalacion ?? true);
  const esNoInstalablePorDefecto = (catId: string, unidad: string) => {
    const cat = categorias.find((c) => String(c.id) === catId);
    return cat?.codigo === "SRV" || unidad === "km" || unidad === "servicio";
  };
  const [instalableEnCampana, setInstalableEnCampana] = useState(
    p?.instalableEnCampana ?? !esNoInstalablePorDefecto(String(categoriaPorDefectoId), "ud"),
  );
  const [instalableManual, setInstalableManual] = useState(Boolean(p));
  const [admiteMedidaLibre, setAdmiteMedidaLibre] = useState(p?.admiteMedidaLibre ?? false);
  const [precioFab, setPrecioFab] = useState(aTexto(p?.precioFabricacion ?? null));
  const [precioInst, setPrecioInst] = useState(aTexto(p?.precioInstalacion ?? null));
  const [pedidoMinimo, setPedidoMinimo] = useState(aTexto(p?.pedidoMinimo ?? null));
  const [ivaPct, setIvaPct] = useState(String(p?.ivaPct ?? 21));
  const [descripcionFactura, setDescripcionFactura] = useState(p?.descripcionFactura ?? "");
  const [material, setMaterial] = useState(p?.material ?? "");
  const [notas, setNotas] = useState(p?.notas ?? "");
  const [activo, setActivo] = useState(p?.activo ?? true);

  const esSuperficie = unidadVenta === "m2" || unidadVenta === "ml";

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  return (
    <div ref={atraparFoco}
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-esp4"
      role="dialog"
      aria-modal="true"
      aria-label={p ? `Editar ${p.nombre}` : "Nuevo producto o servicio"}
    >
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="animate-velo-entrar absolute inset-0 bg-fondo-velo" />
      <form
        className="animate-hoja-subir sm:animate-modal-entrar relative flex max-h-[92dvh] w-full flex-col gap-esp4 overflow-y-auto rounded-t-xl border border-borde-default bg-fondo-superficie p-esp5 shadow-elevado sm:max-w-2xl sm:rounded-xl"
        onSubmit={(e) => {
          e.preventDefault();
          const nFab = permiteFabricacion ? aNumero(precioFab) : null;
          const nInst = permiteInstalacion ? aNumero(precioInst) : null;
          const nMin = unidadVenta === "m2" ? aNumero(pedidoMinimo) : null;
          if (nFab != null && !Number.isFinite(nFab)) return setError("El precio de fabricación no es válido.");
          if (nInst != null && !Number.isFinite(nInst)) return setError("El precio de instalación no es válido.");
          if (nMin != null && !Number.isFinite(nMin)) return setError("El pedido mínimo no es válido.");

          ejecutar(async () => {
            await desenvolver(
              guardarProducto(p?.id ?? null, {
                codigo,
                categoriaId: Number(categoriaId),
                nombre,
                descripcionFactura,
                material,
                unidadVenta,
                admiteMedidaLibre: esSuperficie ? admiteMedidaLibre : false,
                permiteFabricacion,
                permiteInstalacion,
                instalableEnCampana,
                precioFabricacion: nFab,
                precioInstalacion: nInst,
                pedidoMinimo: nMin,
                ivaPct: Number(ivaPct),
                activo,
                notas,
              }),
            );
            onCerrar();
          });
        }}
      >
        <div className="flex items-start gap-esp3">
          <div className="min-w-0 flex-1">
            <h2 className="text-titulo-panel text-texto-primario">
              {p ? `Editar «${p.nombre}»` : "Nuevo producto o servicio"}
            </h2>
            <p className="text-xs text-texto-terciario">
              Configura cómo se cobra y cómo aparece en los documentos nuevos.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
          >
            <Icono nombre="cerrar" size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-esp3 sm:grid-cols-2">
          <label className={`${etiquetaMini} sm:col-span-2`}>
            Nombre del producto o servicio *
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Lona Frontlit 510 g, Montaje de escenario…"
              required
              autoFocus
              className={CAMPO}
            />
          </label>

          <label className={etiquetaMini}>
            Categoría *
            <select
              value={categoriaId}
              onChange={(e) => {
                const nextCat = e.target.value;
                setCategoriaId(nextCat);
                if (!instalableManual) {
                  setInstalableEnCampana(!esNoInstalablePorDefecto(nextCat, unidadVenta));
                }
              }}
              className={CAMPO}
            >
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className={etiquetaMini}>
            Unidad de venta *
            <select
              value={unidadVenta}
              onChange={(e) => {
                const u = e.target.value;
                setUnidadVenta(u);
                if (u !== "m2" && u !== "ml") setAdmiteMedidaLibre(false);
                if (!instalableManual) {
                  setInstalableEnCampana(!esNoInstalablePorDefecto(categoriaId, u));
                }
              }}
              className={CAMPO}
            >
              {UNIDADES_OPCIONES.map((u) => (
                <option key={u.valor} value={u.valor}>
                  {u.etiqueta}
                </option>
              ))}
            </select>
          </label>

          <label className={etiquetaMini}>
            Código interno {p ? "*" : "(opcional)"}
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder={p ? "" : "Auto (ej. LON-FRO)"}
              required={Boolean(p)}
              className={CAMPO}
            />
          </label>

          <label className={etiquetaMini}>
            IVA aplicable
            <select value={ivaPct} onChange={(e) => setIvaPct(e.target.value)} className={CAMPO}>
              {IVAS.map((v) => (
                <option key={v} value={v}>
                  {v} %
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Alcance y precios */}
        <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-sutil/60 p-esp3">
          <p className="text-xs font-semibold uppercase tracking-wide text-texto-terciario">
            Alcance del trabajo y precios base
          </p>
          <div className="flex flex-wrap gap-esp4 text-sm text-texto-primario">
            <label className="inline-flex cursor-pointer items-center gap-esp2">
              <input
                type="checkbox"
                checked={permiteFabricacion}
                onChange={(e) => setPermiteFabricacion(e.target.checked)}
                className="h-4 w-4"
              />
              Permite fabricación / suministro
            </label>
            <label className="inline-flex cursor-pointer items-center gap-esp2">
              <input
                type="checkbox"
                checked={permiteInstalacion}
                onChange={(e) => setPermiteInstalacion(e.target.checked)}
                className="h-4 w-4"
              />
              Permite instalación / servicio
            </label>
          </div>

          <label className="inline-flex cursor-pointer items-center gap-esp2 text-sm text-texto-primario">
            <input
              type="checkbox"
              checked={instalableEnCampana}
              onChange={(e) => {
                setInstalableEnCampana(e.target.checked);
                setInstalableManual(true);
              }}
              className="h-4 w-4"
            />
            Artículo instalable en campañas (disponible al asignar puntos en el mapa)
          </label>

          <div className="grid grid-cols-1 gap-esp3 sm:grid-cols-3">
            <label className={etiquetaMini}>
              Precio fabricación (€/{UNIDAD_CORTA[unidadVenta] ?? unidadVenta})
              <input
                value={precioFab}
                onChange={(e) => setPrecioFab(e.target.value)}
                disabled={!permiteFabricacion}
                inputMode="decimal"
                placeholder="Vacío = según formato / manual"
                className={CAMPO}
              />
            </label>
            <label className={etiquetaMini}>
              Precio instalación (€/{UNIDAD_CORTA[unidadVenta] ?? unidadVenta})
              <input
                value={precioInst}
                onChange={(e) => setPrecioInst(e.target.value)}
                disabled={!permiteInstalacion}
                inputMode="decimal"
                placeholder="Vacío = según formato / manual"
                className={CAMPO}
              />
            </label>
            {unidadVenta === "m2" && (
              <label className={etiquetaMini}>
                Mínimo facturable (m²/unidad)
                <input
                  value={pedidoMinimo}
                  onChange={(e) => setPedidoMinimo(e.target.value)}
                  inputMode="decimal"
                  placeholder="Ej. 1"
                  className={CAMPO}
                />
              </label>
            )}
          </div>

          {esSuperficie && (
            <label className="inline-flex cursor-pointer items-center gap-esp2 text-sm text-texto-primario">
              <input
                type="checkbox"
                checked={admiteMedidaLibre}
                onChange={(e) => setAdmiteMedidaLibre(e.target.checked)}
                className="h-4 w-4"
              />
              Admite medida libre (pide ancho × alto en cm al crear documentos)
            </label>
          )}
        </div>

        {/* Textos y control */}
        <div className="flex flex-col gap-esp3">
          <label className={etiquetaMini}>
            Concepto impreso en factura / presupuesto (opcional)
            <input
              value={descripcionFactura}
              onChange={(e) => setDescripcionFactura(e.target.value)}
              placeholder="Si se deja vacío se usa el nombre del producto"
              className={CAMPO}
            />
          </label>
          <div className="grid grid-cols-1 gap-esp3 sm:grid-cols-2">
            <label className={etiquetaMini}>
              Material / ficha técnica (opcional)
              <input
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                placeholder="Ej. PVC Frontlit 510 g/m²"
                className={CAMPO}
              />
            </label>
            <label className="flex items-end gap-esp2 pb-2 text-sm text-texto-primario">
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="h-4 w-4"
              />
              Activo (visible al añadir líneas a documentos)
            </label>
          </div>
          <label className={etiquetaMini}>
            Notas internas (opcional)
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-borde-campo bg-fondo-superficie p-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20"
            />
          </label>
        </div>

        {error && <p className="text-sm text-texto-peligro">{error}</p>}

        <div className="flex flex-wrap items-center gap-esp2 border-t border-borde-default pt-esp3">
          {p && (
            <Boton
              type="button"
              variante="peligro"
              tamano="s"
              disabled={pendiente}
              onClick={async () => {
                if (!(await confirmar(`¿Eliminar «${p.nombre}» del catálogo? No se puede deshacer.`))) return;
                ejecutar(async () => {
                  await desenvolver(eliminarProducto(p.id));
                  onCerrar();
                });
              }}
            >
              Eliminar
            </Boton>
          )}
          <div className="ml-auto flex items-center gap-esp2">
            <Boton type="button" variante="secundario" onClick={onCerrar} disabled={pendiente}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={pendiente}>
              {p ? "Guardar cambios" : "Crear producto"}
            </Boton>
          </div>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Modal de creación / edición de Categoría
// ---------------------------------------------------------------------

function ModalCategoria({
  categoria: c,
  onCerrar,
}: {
  categoria?: CategoriaAdmin;
  onCerrar: () => void;
}) {
  const { pendiente, error, ejecutar } = useAccion({ refrescar: true });
  const [nombre, setNombre] = useState(c?.nombre ?? "");
  const [codigo, setCodigo] = useState(c?.codigo ?? "");
  const [orden, setOrden] = useState(c ? String(c.orden) : "");

  useEffect(() => {
    const alTeclear = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [onCerrar]);

  return (
    <div ref={atraparFoco}
      className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-esp4"
      role="dialog"
      aria-modal="true"
      aria-label={c ? `Editar categoría ${c.nombre}` : "Nueva categoría"}
    >
      <button type="button" aria-label="Cerrar" onClick={onCerrar} className="animate-velo-entrar absolute inset-0 bg-fondo-velo" />
      <form
        className="animate-hoja-subir sm:animate-modal-entrar relative flex w-full flex-col gap-esp4 rounded-t-xl border border-borde-default bg-fondo-superficie p-esp5 shadow-elevado sm:max-w-md sm:rounded-xl"
        onSubmit={(e) => {
          e.preventDefault();
          ejecutar(async () => {
            await desenvolver(
              guardarCategoria(c?.id ?? null, {
                nombre,
                codigo,
                orden: orden.trim() ? Number(orden) : undefined,
              }),
            );
            onCerrar();
          });
        }}
      >
        <div className="flex items-start gap-esp3">
          <h2 className="flex-1 text-titulo-panel text-texto-primario">
            {c ? "Editar categoría" : "Nueva categoría"}
          </h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-icono-secundario transition-colors duration-rapida ease-suave hover:bg-fondo-sutil active:scale-press"
          >
            <Icono nombre="cerrar" size={20} />
          </button>
        </div>

        <label className={etiquetaMini}>
          Nombre *
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Cartelería, Servicios técnicos…"
            required
            autoFocus
            className={CAMPO}
          />
        </label>

        <div className="grid grid-cols-2 gap-esp3">
          <label className={etiquetaMini}>
            Código {c ? "*" : "(opcional)"}
            <input
              value={codigo}
              onChange={(e) => setCodigo(e.target.value)}
              placeholder={c ? "" : "Auto (ej. SRV)"}
              required={Boolean(c)}
              className={CAMPO}
            />
          </label>
          <label className={etiquetaMini}>
            Orden visual
            <input
              value={orden}
              onChange={(e) => setOrden(e.target.value)}
              inputMode="numeric"
              placeholder="Auto"
              className={CAMPO}
            />
          </label>
        </div>

        {error && <p className="text-sm text-texto-peligro">{error}</p>}

        <div className="flex justify-end gap-esp2">
          <Boton type="button" variante="secundario" onClick={onCerrar} disabled={pendiente}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={pendiente}>
            {c ? "Guardar" : "Crear categoría"}
          </Boton>
        </div>
      </form>
    </div>
  );
}
