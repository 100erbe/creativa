"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { BarraAccion, CAMPO } from "@/components/ui/panel-busqueda";
import { cn } from "@/lib/cn";
import { euros } from "@/lib/formato";
import { ETIQUETA_ALCANCE, ETIQUETA_TIPO } from "@/lib/documentos";
import {
  actualizarLinea,
  anadirLinea,
  anadirLineaLibre,
  eliminarLinea,
  previsualizarPrecio,
} from "./acciones";
import { desenvolver } from "@/lib/accion";
import { confirmar } from "@/components/ui/dialogos";

type Alcance = "fabricacion" | "instalacion" | "fabricacion_instalacion";

export type Cabecera = {
  id: number;
  tipo: string;
  cliente_id: number;
  cliente: string;
  descuento_habitual: number;
  suma_lineas: number;
  base_imponible: number;
  cuota_iva: number;
  total: number;
  campana_id: number | null;
};

type Linea = {
  id: number;
  descripcion: string;
  artista: string | null;
  piezas: number;
  cantidad: number;
  unidad: string;
  precio_unitario: number;
  recargo_acabados: number;
  descuento_pct: number;
  importe: number;
};

export type FormatoCatalogo = {
  id: number;
  codigo: string;
  nombre: string;
  ancho: number | null;
  alto: number | null;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  alias: string[];
};

export type ProductoCatalogo = {
  id: number;
  codigo: string;
  nombre: string;
  descripcionFactura: string | null;
  unidad: string;
  medidaLibre: boolean;
  fabricacion: boolean;
  instalacion: boolean;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  pedidoMinimo: number | null;
  ivaPct: number;
  categoriaId: number | null;
  categoria: string;
  ordenCategoria: number;
  formatos: FormatoCatalogo[];
};

export type CategoriaOpcion = {
  id: number;
  nombre: string;
  orden: number;
};

type Reciente = {
  producto_id: number;
  formato_id: number | null;
  alcance: string;
  ultimo_precio: number;
  ultimo_descuento: number;
};

const UNIDAD: Record<string, string> = {
  ud: "ud",
  m2: "m²",
  ml: "ml",
  millar: "millar",
  mes: "mes",
  servicio: "servicio",
  km: "km",
};

/** "12,5" o "12.5" → 12.5 ("1.250,5" → 1250.5); vacío o inválido → NaN */
function num(valor: string) {
  const t = valor.trim().replace(/\s|€|%/g, "");
  if (t === "") return NaN;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}
/** Para inputs: 12.5 → "12,5" (sin separador de miles para que num() lo relea bien). */
function texto(valor: number, decimales = 2) {
  return Number.isFinite(valor) ? String(Math.round(valor * 10 ** decimales) / 10 ** decimales).replace(".", ",") : "";
}

function normalizar(t: string) {
  return t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function alcancesDe(p: ProductoCatalogo): Alcance[] {
  if (p.fabricacion && p.instalacion) return ["fabricacion_instalacion", "fabricacion", "instalacion"];
  if (p.fabricacion) return ["fabricacion"];
  if (p.instalacion) return ["instalacion"];
  return ["fabricacion_instalacion"];
}

function calcularCantidadLocal(
  unidad: string,
  piezas: number,
  anchoCm: number,
  altoCm: number,
  pedidoMinimo: number | null,
) {
  if (!Number.isFinite(piezas)) return NaN;
  if ((unidad === "m2" || unidad === "ml") && Number.isFinite(anchoCm) && Number.isFinite(altoCm)) {
    if (unidad === "m2") {
      return piezas * Math.max((anchoCm * altoCm) / 10000, pedidoMinimo ?? 0);
    }
    return (piezas * 2 * (anchoCm + altoCm)) / 100;
  }
  return piezas;
}

function calcularPrecioBaseLocal(p: ProductoCatalogo, formatoId: number | null, alcance: Alcance) {
  const f = formatoId != null ? p.formatos.find((x) => x.id === formatoId) : undefined;
  const fabRaw = f?.precioFabricacion ?? p.precioFabricacion;
  const instRaw = f?.precioInstalacion ?? p.precioInstalacion;
  const fab = fabRaw ?? 0;
  const inst = instRaw ?? 0;
  const precio = alcance === "fabricacion" ? fab : alcance === "instalacion" ? inst : fab + inst;
  const definido =
    alcance === "fabricacion"
      ? fabRaw != null
      : alcance === "instalacion"
        ? instRaw != null
        : fabRaw != null || instRaw != null;
  return { precio, definido };
}

export function PasoLineas({
  documento,
  lineas,
  catalogo,
  categorias,
  recientes,
}: {
  documento: Cabecera;
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
          <h1 className="text-2xl font-semibold text-texto-primario">
            {etiquetaTipo} en borrador
          </h1>
        </div>
        <Link href="/admin/documentos">
          <Boton variante="secundario">Guardar y salir</Boton>
        </Link>
      </div>

      <PasosDocumento actual={2} documentoId={documento.id} />

      <div className="flex flex-col gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4">
          {/* Cliente (compacto) */}
          <div className="flex items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp5 py-esp3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-fondo-marca-sutil text-sm font-medium text-texto-marca">
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
          </div>

          {/* En pantallas estrechas el resumen queda abajo: lista compacta sobre el formulario. */}
          {lineas.length > 0 && (
            <div className="rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3 xl:hidden">
              <ListaCompacta lineas={lineas} />
            </div>
          )}

          <FormularioArticulo
            documento={documento}
            catalogo={catalogo}
            categorias={categorias}
            artistas={[...new Set(lineas.map((l) => l.artista).filter((a): a is string => !!a))]}
            recientes={recientesVisibles}
            onAnadido={() => router.refresh()}
          />

          <TablaLineas documentoId={documento.id} lineas={lineas} />
        </div>

        {/* Resumen */}
        <div className="flex w-full shrink-0 flex-col gap-esp4 xl:w-[340px]">
          <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5 xl:sticky xl:top-esp5">
            <h2 className="text-base font-semibold text-texto-primario">Resumen</h2>
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
          </div>
        </div>
      </div>
    </div>
  );
}

/** Lista dinámica y compacta de lo ya añadido; se actualiza con cada router.refresh(). */
function ListaCompacta({ lineas }: { lineas: Linea[] }) {
  return (
    <div className="flex flex-col gap-esp2">
      <p className="text-xs font-medium uppercase tracking-wide text-texto-terciario">
        Ya añadidos ({lineas.length})
      </p>
      <ul className="flex max-h-60 flex-col gap-esp2 overflow-y-auto">
        {lineas.map((l) => (
          <li key={l.id} className="flex items-start gap-esp2 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-texto-primario" title={l.descripcion}>
                {l.descripcion}
              </span>
              <span className="block truncate text-xs text-texto-terciario">
                {l.artista ? `${l.artista} · ` : ""}
                {texto(l.piezas, 3)} ud
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-texto-primario">{euros(l.importe)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------
//  Formulario para añadir un artículo del catálogo (inserción rápida)
// ---------------------------------------------------------------------

const entrada = CAMPO;

function FormularioArticulo({
  documento,
  catalogo,
  categorias,
  artistas,
  recientes,
  onAnadido,
}: {
  documento: Cabecera;
  catalogo: ProductoCatalogo[];
  categorias: CategoriaOpcion[];
  artistas: string[];
  recientes: (Reciente & { etiqueta: string })[];
  onAnadido: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string | null>(null);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [productoId, setProductoId] = useState<number | null>(null);
  const [formatoId, setFormatoId] = useState<number | null>(null);
  const [alcance, setAlcance] = useState<Alcance>("fabricacion_instalacion");
  const [piezas, setPiezas] = useState("1");
  const [ancho, setAncho] = useState("");
  const [alto, setAlto] = useState("");
  const [precio, setPrecio] = useState("");
  const [precioManual, setPrecioManual] = useState(false);
  const [descuento, setDescuento] = useState(texto(documento.descuento_habitual));
  const [descripcion, setDescripcion] = useState("");
  const [artista, setArtista] = useState("");
  const [tarifa, setTarifa] = useState<{ precio: number; cantidad: number } | null>(null);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();
  const [pendienteRecienteKey, setPendienteRecienteKey] = useState<string | null>(null);
  const [libre, setLibre] = useState(false);
  const [libreInicial, setLibreInicial] = useState("");

  const inputBusquedaRef = useRef<HTMLInputElement>(null);
  const inputPiezasRef = useRef<HTMLInputElement>(null);
  const inputAnchoRef = useRef<HTMLInputElement>(null);

  const producto = catalogo.find((p) => p.id === productoId) ?? null;
  const conMedidas = producto?.unidad === "m2" || producto?.unidad === "ml";

  const categoriasCatalogo = useMemo(() => {
    const vistas = new Map<string, number>();
    for (const p of catalogo) {
      vistas.set(p.categoria, (vistas.get(p.categoria) ?? 0) + 1);
    }
    return [...vistas.entries()].map(([nombre, conteo]) => ({ nombre, conteo }));
  }, [catalogo]);

  const resultados = useMemo(() => {
    const q = normalizar(busqueda.trim());
    const lista = catalogo.filter((p) => {
      if (categoriaFiltro && categoriaFiltro !== "__todas__" && p.categoria !== categoriaFiltro) return false;
      if (!q) return true;
      const textoFormatos = p.formatos
        .map((f) => `${f.nombre} ${f.codigo} ${f.alias.join(" ")}`)
        .join(" ");
      return normalizar(
        `${p.nombre} ${p.codigo} ${p.descripcionFactura ?? ""} ${p.categoria} ${textoFormatos}`,
      ).includes(q);
    });
    const grupos = new Map<string, ProductoCatalogo[]>();
    for (const p of lista) grupos.set(p.categoria, [...(grupos.get(p.categoria) ?? []), p]);
    return [...grupos.entries()];
  }, [busqueda, categoriaFiltro, catalogo]);

  const mostrarResultados = busqueda.trim() !== "" || categoriaFiltro !== null || listaAbierta;

  function elegirProducto(
    p: ProductoCatalogo,
    opciones?: { formatoId?: number | null; alcance?: string; precio?: number; descuento?: number },
  ) {
    const f =
      p.formatos.find((x) => x.id === opciones?.formatoId) ?? (p.formatos.length === 1 ? p.formatos[0] : undefined);
    const nextFormatoId = f?.id ?? null;
    const permitidos = alcancesDe(p);
    const nextAlcance = permitidos.includes(opciones?.alcance as Alcance)
      ? (opciones!.alcance as Alcance)
      : permitidos[0]!;

    setProductoId(p.id);
    setFormatoId(nextFormatoId);
    setAlcance(nextAlcance);
    setPiezas("1");
    setAncho(f?.ancho != null ? texto(f.ancho) : "");
    setAlto(f?.alto != null ? texto(f.alto) : "");
    setDescripcion("");
    setError(null);

    if (opciones?.precio != null) {
      setPrecio(texto(opciones.precio, 4));
      setPrecioManual(true);
    } else {
      const base = calcularPrecioBaseLocal(p, nextFormatoId, nextAlcance);
      setPrecio(base.definido ? texto(base.precio, 4) : "");
      setPrecioManual(false);
    }

    setDescuento(texto(opciones?.descuento ?? documento.descuento_habitual));
    setBusqueda("");
    setListaAbierta(false);

    const necesitaMedidas = (p.unidad === "m2" || p.unidad === "ml") && !(f?.ancho != null && f?.alto != null);
    requestAnimationFrame(() => {
      const campo = necesitaMedidas ? inputAnchoRef.current : inputPiezasRef.current;
      campo?.focus();
      campo?.select();
    });
  }

  function elegirFormato(id: number | null) {
    setFormatoId(id);
    const f = producto?.formatos.find((x) => x.id === id);
    if (f?.ancho != null && f.alto != null) {
      setAncho(texto(f.ancho));
      setAlto(texto(f.alto));
    }
    if (producto && !precioManual) {
      const base = calcularPrecioBaseLocal(producto, id, alcance);
      if (base.definido) setPrecio(texto(base.precio, 4));
    }
  }

  function elegirAlcance(next: Alcance) {
    setAlcance(next);
    if (producto && !precioManual) {
      const base = calcularPrecioBaseLocal(producto, formatoId, next);
      if (base.definido) setPrecio(texto(base.precio, 4));
    }
  }

  function alPulsarEnterEnBusqueda() {
    const q = normalizar(busqueda.trim());
    if (!q) return;
    const formatosCoincidentes: { producto: ProductoCatalogo; formato: FormatoCatalogo }[] = [];
    for (const [, prods] of resultados) {
      for (const p of prods) {
        for (const f of p.formatos) {
          if (normalizar(`${f.nombre} ${f.codigo} ${f.alias.join(" ")}`).includes(q)) {
            formatosCoincidentes.push({ producto: p, formato: f });
          }
        }
      }
    }
    if (formatosCoincidentes.length === 1) {
      const m = formatosCoincidentes[0]!;
      elegirProducto(m.producto, { formatoId: m.formato.id });
      return;
    }
    const productosPlanos = resultados.flatMap(([, prods]) => prods);
    if (productosPlanos.length === 1) {
      elegirProducto(productosPlanos[0]!);
    }
  }

  function anadirRapidoReciente(r: Reciente & { etiqueta: string }, clave: string) {
    const p = catalogo.find((c) => c.id === r.producto_id);
    if (!p) return;
    const f = p.formatos.find((x) => x.id === r.formato_id);
    const permitidos = alcancesDe(p);
    const alc = permitidos.includes(r.alcance as Alcance) ? (r.alcance as Alcance) : permitidos[0]!;
    setError(null);
    setPendienteRecienteKey(clave);
    iniciar(async () => {
      try {
        await desenvolver(
          anadirLinea(documento.id, {
            productoId: p.id,
            formatoId: f?.id ?? null,
            alcance: alc,
            piezas: 1,
            anchoCm: f?.ancho ?? null,
            altoCm: f?.alto ?? null,
            precio: r.ultimo_precio,
            descuento: r.ultimo_descuento,
          }),
        );
        onAnadido();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo añadir el artículo.");
      } finally {
        setPendienteRecienteKey(null);
      }
    });
  }

  // Tarifa real del cliente/volumen en segundo plano (sin bloquear el alta ni la vista del precio base).
  const nPiezas = num(piezas);
  const nAncho = conMedidas ? num(ancho) : NaN;
  const nAlto = conMedidas ? num(alto) : NaN;
  useEffect(() => {
    if (!producto || !Number.isFinite(nPiezas) || nPiezas === 0) {
      setTarifa(null);
      return;
    }
    const medidas = Number.isFinite(nAncho) && Number.isFinite(nAlto);
    let cancelado = false;
    setCalculando(true);
    const t = setTimeout(async () => {
      try {
        const r = await desenvolver(
          previsualizarPrecio({
            clienteId: documento.cliente_id,
            productoId: producto.id,
            formatoId,
            alcance,
            piezas: nPiezas,
            anchoCm: medidas ? nAncho : null,
            altoCm: medidas ? nAlto : null,
          }),
        );
        if (cancelado) return;
        setTarifa(r);
        if (!precioManual) setPrecio(texto(r.precio, 4));
      } catch {
        if (!cancelado) setTarifa(null);
      } finally {
        if (!cancelado) setCalculando(false);
      }
    }, 150);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // precioManual a propósito fuera: al restaurar la tarifa se fuerza abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto?.id, formatoId, alcance, nPiezas, nAncho, nAlto, documento.cliente_id]);

  const nPrecio = num(precio);
  const nDescuento = descuento.trim() === "" ? 0 : num(descuento);
  const cantidadLocal = producto
    ? calcularCantidadLocal(producto.unidad, nPiezas, nAncho, nAlto, producto.pedidoMinimo)
    : nPiezas;
  const cantidad = tarifa?.cantidad ?? cantidadLocal;
  const importe =
    Number.isFinite(cantidad) && Number.isFinite(nPrecio) && Number.isFinite(nDescuento)
      ? Math.round(cantidad * nPrecio * (1 - nDescuento / 100) * 100) / 100
      : null;
  const distintoDeTarifa = tarifa != null && Number.isFinite(nPrecio) && Math.abs(nPrecio - tarifa.precio) > 0.00005;

  function anadir() {
    if (!producto) return;
    setError(null);
    if (!Number.isFinite(nPiezas) || nPiezas === 0) return setError("Indica la cantidad.");
    if (!Number.isFinite(nPrecio) || nPrecio < 0) return setError("Indica un precio unitario válido.");
    if (!Number.isFinite(nDescuento) || nDescuento < 0 || nDescuento > 100)
      return setError("El descuento va de 0 a 100 %.");
    const medidas = conMedidas && Number.isFinite(nAncho) && Number.isFinite(nAlto);
    if (conMedidas && Number.isFinite(nAncho) !== Number.isFinite(nAlto))
      return setError("Indica ancho y alto, o deja los dos vacíos.");

    iniciar(async () => {
      try {
        await desenvolver(
          anadirLinea(documento.id, {
            productoId: producto.id,
            formatoId,
            alcance,
            piezas: nPiezas,
            anchoCm: medidas ? nAncho : null,
            altoCm: medidas ? nAlto : null,
            // Si no se editó a mano, la BD aplica la tarifa exacta (cliente/volumen/formato).
            precio: precioManual || distintoDeTarifa ? nPrecio : null,
            descuento: nDescuento,
            descripcion,
            artista,
          }),
        );
        setProductoId(null);
        setTarifa(null);
        onAnadido();
        requestAnimationFrame(() => inputBusquedaRef.current?.focus());
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo añadir el artículo.");
      }
    });
  }

  if (libre) {
    return (
      <FormularioLineaLibre
        documento={documento}
        categorias={categorias}
        artistas={artistas}
        descripcionInicial={libreInicial}
        onAnadido={onAnadido}
        onCancelar={() => {
          setLibre(false);
          setLibreInicial("");
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
      <div>
        <h2 className="text-base font-semibold text-texto-primario">Añadir artículo</h2>
        <p className="text-sm text-texto-secundario">
          Busca por nombre, código o alias (70C, sábana, mupi…) o elige una categoría para añadir en 1 clic.
        </p>
      </div>

      {!producto && (
        <>
          {recientes.length > 0 && (
            <div className="flex flex-col gap-esp2">
              <div className="flex items-center gap-esp2">
                <Icono nombre="reloj" size={14} className="text-icono-secundario" />
                <span className="text-xs font-medium text-texto-terciario">
                  USADO RECIENTEMENTE CON ESTE CLIENTE (clic para configurar · +1 para añadir ya)
                </span>
              </div>
              <div className="flex flex-wrap gap-esp2">
                {recientes.map((r, i) => {
                  const clave = `${r.producto_id}-${r.formato_id}-${r.alcance}-${i}`;
                  return (
                    <div
                      key={clave}
                      className="inline-flex min-h-10 items-center overflow-hidden rounded-completo border border-borde-campo bg-fondo-superficie text-xs font-medium text-texto-primario"
                    >
                      <button
                        type="button"
                        disabled={pendiente}
                        onClick={() => {
                          const p = catalogo.find((c) => c.id === r.producto_id);
                          if (p)
                            elegirProducto(p, {
                              formatoId: r.formato_id,
                              alcance: r.alcance,
                              precio: r.ultimo_precio,
                              descuento: r.ultimo_descuento,
                            });
                        }}
                        className="flex h-full items-center gap-1 px-esp3 py-1.5 hover:bg-fondo-sutil disabled:opacity-50"
                      >
                        <span>{r.etiqueta}</span>
                        <span className="text-texto-terciario">· {euros(r.ultimo_precio)}</span>
                      </button>
                      <button
                        type="button"
                        disabled={pendiente}
                        title={`Añadir 1 ud de ${r.etiqueta} directamente`}
                        aria-label={`Añadir 1 de ${r.etiqueta} ahora`}
                        onClick={() => anadirRapidoReciente(r, clave)}
                        className="flex h-full items-center border-l border-borde-default bg-fondo-marca-sutil/70 px-esp3 py-1.5 font-semibold text-texto-marca transition-colors hover:bg-fondo-marca hover:text-texto-sobre-marca disabled:opacity-50"
                      >
                        {pendienteRecienteKey === clave ? "…" : "+1"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Buscador directo + píldoras de categoría */}
          <div className="flex flex-col gap-esp3">
            <div className="relative">
              <Icono
                nombre="buscar"
                size={16}
                className="pointer-events-none absolute left-esp3 top-1/2 -translate-y-1/2 text-icono-secundario"
              />
              <input
                ref={inputBusquedaRef}
                type="search"
                enterKeyHint="search"
                value={busqueda}
                onFocus={() => setListaAbierta(true)}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setListaAbierta(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setListaAbierta(false);
                    setBusqueda("");
                    setCategoriaFiltro(null);
                    inputBusquedaRef.current?.blur();
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    alPulsarEnterEnBusqueda();
                  }
                }}
                placeholder="Buscar en el catálogo: lona, 70C, sábana, mupi, montaje…"
                aria-label="Buscar en el catálogo"
                className={`${entrada} pl-9`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  setCategoriaFiltro((prev) => (prev === "__todas__" ? null : "__todas__"))
                }
                aria-pressed={categoriaFiltro === "__todas__"}
                className={cn(
                  "inline-flex min-h-8 items-center rounded-completo px-esp3 text-xs font-medium transition-colors",
                  categoriaFiltro === "__todas__"
                    ? "bg-fondo-marca text-texto-sobre-marca"
                    : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil",
                )}
              >
                Todos ({catalogo.length})
              </button>
              {categoriasCatalogo.map((c) => {
                const activo = categoriaFiltro === c.nombre;
                return (
                  <button
                    key={c.nombre}
                    type="button"
                    onClick={() => setCategoriaFiltro(activo ? null : c.nombre)}
                    aria-pressed={activo}
                    className={cn(
                      "inline-flex min-h-8 items-center gap-1 rounded-completo px-esp3 text-xs font-medium transition-colors",
                      activo
                        ? "bg-fondo-marca text-texto-sobre-marca"
                        : "border border-borde-default bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil",
                    )}
                  >
                    <span>{c.nombre}</span>
                    <span className={cn("tabular-nums text-micro", activo ? "opacity-80" : "text-texto-terciario")}>
                      {c.conteo}
                    </span>
                  </button>
                );
              })}
              {mostrarResultados && (
                <button
                  type="button"
                  onClick={() => {
                    setListaAbierta(false);
                    setCategoriaFiltro(null);
                    setBusqueda("");
                  }}
                  className="ml-auto text-xs font-medium text-texto-terciario hover:text-texto-primario"
                >
                  Ocultar lista
                </button>
              )}
            </div>

            {mostrarResultados && (
              <div className="flex max-h-96 flex-col divide-y divide-fondo-hover overflow-y-auto rounded-lg border border-borde-default bg-fondo-superficie shadow-sm">
                {resultados.map(([categoria, productos]) => (
                  <div key={categoria} className="flex flex-col">
                    <span className="sticky top-0 z-10 border-b border-fondo-hover bg-fondo-sutil/95 px-esp3 py-1.5 text-micro font-semibold uppercase tracking-wider text-texto-terciario backdrop-blur-sm">
                      {categoria}
                    </span>
                    <div className="flex flex-col divide-y divide-fondo-hover">
                      {productos.map((p) => {
                        const alcDef = alcancesDe(p)[0]!;
                        const base = calcularPrecioBaseLocal(p, null, alcDef);
                        const unidad = UNIDAD[p.unidad] ?? p.unidad;
                        return (
                          <div key={p.id} className="flex flex-col gap-esp2 px-esp3 py-esp2 hover:bg-fondo-sutil/50">
                            <button
                              type="button"
                              onClick={() => elegirProducto(p)}
                              className="flex w-full items-center gap-esp3 text-left"
                            >
                              <span className="flex min-w-0 flex-1 flex-col">
                                <span className="text-sm font-medium text-texto-primario">{p.nombre}</span>
                                <span className="truncate text-xs text-texto-terciario">
                                  {p.codigo} · por {unidad}
                                  {p.descripcionFactura ? ` · ${p.descripcionFactura}` : ""}
                                </span>
                              </span>
                              <span className="tabular-nums shrink-0 text-xs font-medium text-texto-secundario">
                                {base.definido ? `${euros(base.precio)}/${unidad}` : `por ${unidad}`}
                              </span>
                            </button>

                            {p.formatos.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 pb-0.5">
                                {p.formatos.map((f) => {
                                  const precioFmt = calcularPrecioBaseLocal(p, f.id, alcDef);
                                  return (
                                    <button
                                      key={f.id}
                                      type="button"
                                      onClick={() => elegirProducto(p, { formatoId: f.id })}
                                      className="inline-flex min-h-8 items-center gap-1 rounded-md border border-borde-campo bg-fondo-superficie px-esp2 py-1 text-xs text-texto-primario transition-colors hover:border-borde-foco hover:bg-fondo-marca-sutil hover:text-texto-marca"
                                    >
                                      <span className="font-medium">{f.nombre}</span>
                                      {precioFmt.definido && (
                                        <span className="tabular-nums text-texto-terciario">
                                          · {euros(precioFmt.precio)}
                                        </span>
                                      )}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {resultados.length === 0 && (
                  <div className="flex flex-col gap-esp2 px-esp4 py-esp4 text-sm text-texto-terciario">
                    <p>Nada en el catálogo con «{busqueda}».</p>
                    {categoriaFiltro && categoriaFiltro !== "__todas__" && (
                      <button
                        type="button"
                        onClick={() => setCategoriaFiltro("__todas__")}
                        className="w-fit text-xs font-medium text-texto-marca hover:underline"
                      >
                        Buscar en todas las categorías
                      </button>
                    )}
                  </div>
                )}

                {busqueda.trim() !== "" && (
                  <button
                    type="button"
                    onClick={() => {
                      setLibreInicial(busqueda.trim());
                      setLibre(true);
                    }}
                    className="flex min-h-11 items-center gap-esp2 bg-fondo-sutil/60 px-esp3 py-esp2 text-left text-sm font-medium text-texto-marca hover:bg-fondo-marca-sutil"
                  >
                    <Icono nombre="mas" size={16} />
                    Añadir «{busqueda.trim()}» como concepto nuevo (con opción de guardar en catálogo)
                  </button>
                )}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-texto-peligro">{error}</p>}

          <button
            type="button"
            onClick={() => {
              setLibreInicial("");
              setLibre(true);
            }}
            className="w-fit text-sm font-medium text-texto-marca hover:underline"
          >
            ¿No está en el catálogo? Añadir un concepto libre o crearlo al vuelo
          </button>
        </>
      )}

      {producto && (
        <form
          className="flex flex-col gap-esp4"
          onSubmit={(e) => {
            e.preventDefault();
            anadir();
          }}
        >
          <div className="flex items-center gap-esp3 rounded-md bg-fondo-sutil px-esp3 py-esp2">
            <div className="flex-1">
              <p className="text-sm font-medium text-texto-primario">{producto.nombre}</p>
              <p className="text-xs text-texto-terciario">
                {producto.categoria} · se vende por {UNIDAD[producto.unidad] ?? producto.unidad}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setProductoId(null)}
              className="text-sm font-medium text-texto-marca"
            >
              Cambiar artículo
            </button>
          </div>

          <div className="grid grid-cols-2 gap-esp3 md:grid-cols-4">
            {producto.formatos.length > 0 && (
              <Etiqueta texto="Formato" className="col-span-2" grupo={producto.formatos.length <= 4}>
                {producto.formatos.length <= 4 ? (
                  <div className="flex flex-wrap gap-esp2">
                    {[
                      { id: null as number | null, nombre: producto.medidaLibre ? "A medida" : "Sin formato" },
                      ...producto.formatos,
                    ].map((f) => (
                      <button
                        key={f.id ?? "ninguno"}
                        type="button"
                        onClick={() => elegirFormato(f.id)}
                        aria-pressed={formatoId === f.id}
                        className={cn(
                          "min-h-11 rounded-md border px-esp3 text-sm font-medium md:min-h-9",
                          formatoId === f.id
                            ? "border-borde-foco bg-fondo-marca-sutil text-texto-marca"
                            : "border-borde-campo bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil",
                        )}
                      >
                        {f.nombre}
                      </button>
                    ))}
                  </div>
                ) : (
                  <select
                    value={formatoId ?? ""}
                    onChange={(e) => elegirFormato(e.target.value ? Number(e.target.value) : null)}
                    className={entrada}
                  >
                    <option value="">{producto.medidaLibre ? "A medida" : "Sin formato"}</option>
                    {producto.formatos.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.nombre}
                      </option>
                    ))}
                  </select>
                )}
              </Etiqueta>
            )}
            <Etiqueta texto="Alcance" className="col-span-2" grupo>
              <div className="flex flex-wrap gap-esp2">
                {alcancesDe(producto).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => elegirAlcance(a)}
                    aria-pressed={alcance === a}
                    className={cn(
                      "min-h-11 flex-1 rounded-md border px-esp3 text-xs font-medium md:min-h-9",
                      alcance === a
                        ? "border-borde-foco bg-fondo-marca text-texto-sobre-marca"
                        : "border-borde-campo bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil",
                    )}
                  >
                    {ETIQUETA_ALCANCE[a]}
                  </button>
                ))}
              </div>
            </Etiqueta>

            <Etiqueta texto={conMedidas ? "Piezas" : `Cantidad (${UNIDAD[producto.unidad] ?? producto.unidad})`}>
              <input
                ref={inputPiezasRef}
                value={piezas}
                onChange={(e) => setPiezas(e.target.value)}
                inputMode="decimal"
                enterKeyHint="done"
                className={entrada}
              />
            </Etiqueta>
            {conMedidas && (
              <>
                <Etiqueta texto="Ancho (cm)">
                  <input
                    ref={inputAnchoRef}
                    value={ancho}
                    onChange={(e) => setAncho(e.target.value)}
                    inputMode="decimal"
                    className={entrada}
                  />
                </Etiqueta>
                <Etiqueta texto="Alto (cm)">
                  <input value={alto} onChange={(e) => setAlto(e.target.value)} inputMode="decimal" className={entrada} />
                </Etiqueta>
                <div className="flex flex-col justify-end pb-2 text-xs text-texto-terciario">
                  {Number.isFinite(cantidadLocal) && Number.isFinite(nAncho)
                    ? `= ${texto(cantidadLocal, 3)} ${UNIDAD[producto.unidad]}`
                    : "Sin medidas = cantidad directa"}
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-esp3 md:grid-cols-4">
            <Etiqueta texto={`Precio unitario (€/${UNIDAD[producto.unidad] ?? producto.unidad})`}>
              <input
                value={precio}
                onChange={(e) => {
                  setPrecio(e.target.value);
                  setPrecioManual(true);
                }}
                inputMode="decimal"
                placeholder="0,00"
                className={cn(entrada, distintoDeTarifa && "border-borde-aviso bg-fondo-aviso-sutil")}
              />
            </Etiqueta>
            <Etiqueta texto="Descuento (%)">
              <input value={descuento} onChange={(e) => setDescuento(e.target.value)} inputMode="decimal" className={entrada} />
            </Etiqueta>
            <div className="col-span-2 flex flex-col justify-end gap-1 text-xs">
              {calculando ? (
                <span className="text-texto-terciario">Comprobando tarifa del cliente…</span>
              ) : tarifa ? (
                <span className="text-texto-terciario">
                  Tarifa: {euros(tarifa.precio)}
                  {tarifa.precio === 0 && " (sin precio en catálogo: escríbelo a mano)"}
                </span>
              ) : null}
              {distintoDeTarifa && tarifa && (
                <button
                  type="button"
                  onClick={() => {
                    setPrecio(texto(tarifa.precio, 4));
                    setPrecioManual(false);
                  }}
                  className="w-fit font-medium text-texto-marca"
                >
                  Precio modificado · volver a la tarifa
                </button>
              )}
            </div>
          </div>

          <Etiqueta texto="Artista / referencia (opcional)" grupo>
            {artistas.length > 0 && (
              <div className="flex flex-wrap gap-esp2">
                {artistas.map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setArtista(artista === a ? "" : a)}
                    aria-pressed={artista === a}
                    className={cn(
                      "min-h-10 rounded-completo border px-esp3 text-xs font-medium",
                      artista === a
                        ? "border-borde-foco bg-fondo-marca-sutil text-texto-marca"
                        : "border-borde-campo bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil",
                    )}
                  >
                    {a}
                  </button>
                ))}
              </div>
            )}
            <input
              value={artista}
              onChange={(e) => setArtista(e.target.value)}
              enterKeyHint="next"
              placeholder="Ej. Artista A — gira 2026"
              className={entrada}
            />
            <span className="text-xs text-texto-terciario">
              Sale en la factura debajo del concepto. Útil si el documento mezcla varios artistas.
            </span>
          </Etiqueta>

          <Etiqueta texto="Concepto en el documento (opcional)">
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={`${producto.descripcionFactura || producto.nombre}${formatoId ? ` · ${producto.formatos.find((f) => f.id === formatoId)?.nombre ?? ""}` : ""}`}
              className={entrada}
            />
          </Etiqueta>

          {error && <p className="text-sm text-texto-peligro">{error}</p>}

          <div className="flex items-center gap-esp3 border-t border-fondo-hover pt-esp3">
            <div className="flex-1">
              <p className="text-xs text-texto-terciario">Importe de la línea</p>
              <p className="text-lg font-semibold text-texto-primario">
                {importe != null ? euros(importe) : "—"}
              </p>
            </div>
            <Boton type="button" variante="secundario" className="min-h-11" onClick={() => setProductoId(null)}>
              Cancelar
            </Boton>
            <Boton type="submit" className="min-h-11" cargando={pendiente}>
              <Icono nombre="mas" size={16} />
              Añadir
            </Boton>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Tabla de líneas con edición en línea
// ---------------------------------------------------------------------

function TablaLineas({ documentoId, lineas }: { documentoId: number; lineas: Linea[] }) {
  return (
    <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp4 md:overflow-x-auto md:px-esp6 md:py-esp5">
      <div>
        <h2 className="text-base font-semibold text-texto-primario">Artículos · {lineas.length}</h2>
        {lineas.length > 0 && (
          <p className="text-xs text-texto-terciario">Toca cantidad, precio o descuento para cambiarlos.</p>
        )}
      </div>
      <div className="hidden min-w-[620px] grid-cols-[1fr_80px_100px_70px_100px_24px] gap-esp3 text-xs font-medium text-texto-terciario md:grid">
        <span>CONCEPTO</span>
        <span className="text-right">CANT.</span>
        <span className="text-right">PRECIO</span>
        <span className="text-right">DTO. %</span>
        <span className="text-right">IMPORTE</span>
        <span />
      </div>
      <div className="flex flex-col divide-y divide-fondo-hover md:min-w-[620px]">
        {lineas.map((l) => (
          <FilaLinea key={`${l.id}-${l.piezas}-${l.precio_unitario}-${l.descuento_pct}-${l.descripcion}-${l.artista ?? ""}`} documentoId={documentoId} linea={l} />
        ))}
        {lineas.length === 0 && (
          <p className="py-esp4 text-sm text-texto-terciario">Todavía no has añadido ningún artículo.</p>
        )}
      </div>
    </div>
  );
}

function FilaLinea({ documentoId, linea }: { documentoId: number; linea: Linea }) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [descripcion, setDescripcion] = useState(linea.descripcion);
  const [piezas, setPiezas] = useState(texto(linea.piezas, 3));
  const [precio, setPrecio] = useState(texto(linea.precio_unitario, 4));
  const [descuento, setDescuento] = useState(texto(linea.descuento_pct));
  const [artista, setArtista] = useState(linea.artista ?? "");

  function guardar(cambios: Parameters<typeof actualizarLinea>[2]) {
    setError(null);
    iniciar(async () => {
      try {
        await desenvolver(actualizarLinea(documentoId, linea.id, cambios));
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }

  function confirmarNumero(valor: string, original: number, campo: "piezas" | "precio_unitario" | "descuento_pct", restaurar: () => void) {
    const n = campo === "descuento_pct" && valor.trim() === "" ? 0 : num(valor);
    if (!Number.isFinite(n)) return restaurar();
    if (Math.abs(n - original) < 0.00005) return;
    guardar({ [campo]: n });
  }

  const celda =
    "h-11 w-full rounded-md border border-borde-campo bg-fondo-superficie px-esp2 text-right text-base text-texto-primario outline-none focus:border-borde-foco md:h-8 md:border-transparent md:bg-transparent md:text-sm md:hover:border-borde-default md:focus:bg-fondo-superficie";
  const etiquetaMovil = "text-micro text-texto-terciario md:hidden";
  const alPulsarEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <div className={cn("flex flex-col py-esp3 md:py-esp2", pendiente && "opacity-60")}>
      <div className="grid grid-cols-3 items-end gap-esp2 md:grid-cols-[1fr_80px_100px_70px_100px_24px] md:items-center md:gap-esp3">
        <div className="col-span-3 min-w-0 md:col-span-1">
          <input
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
            onBlur={() => {
              if (!descripcion.trim()) return setDescripcion(linea.descripcion);
              if (descripcion !== linea.descripcion) guardar({ descripcion: descripcion.trim() });
            }}
            onKeyDown={alPulsarEnter}
            aria-label="Concepto"
            title={descripcion}
            className={cn(celda, "text-left font-medium")}
          />
          <input
            value={artista}
            onChange={(e) => setArtista(e.target.value)}
            onBlur={() => {
              if (artista.trim() !== (linea.artista ?? "")) guardar({ artista });
            }}
            onKeyDown={alPulsarEnter}
            placeholder="+ Artista / referencia"
            aria-label="Artista"
            className="mt-1 h-11 w-full rounded-md border border-borde-campo bg-fondo-superficie px-esp2 text-left text-base text-texto-secundario outline-none placeholder:text-texto-terciario focus:border-borde-foco md:mt-0 md:h-7 md:border-transparent md:bg-transparent md:text-xs md:hover:border-borde-default md:focus:bg-fondo-superficie"
          />
          {linea.cantidad !== linea.piezas && (
            <p className="px-esp2 text-xs text-texto-terciario">
              {texto(linea.piezas, 3)} pzs → {texto(linea.cantidad, 3)} {UNIDAD[linea.unidad] ?? linea.unidad}
            </p>
          )}
        </div>
        <label className="flex flex-col gap-0.5">
          <span className={etiquetaMovil}>Cant.</span>
          <input
            value={piezas}
            onChange={(e) => setPiezas(e.target.value)}
            onBlur={() => confirmarNumero(piezas, linea.piezas, "piezas", () => setPiezas(texto(linea.piezas, 3)))}
            onKeyDown={alPulsarEnter}
            inputMode="decimal"
            enterKeyHint="done"
            aria-label="Cantidad"
            className={celda}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={etiquetaMovil}>Precio €</span>
          <input
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            onBlur={() =>
              confirmarNumero(precio, linea.precio_unitario, "precio_unitario", () =>
                setPrecio(texto(linea.precio_unitario, 4)),
              )
            }
            onKeyDown={alPulsarEnter}
            inputMode="decimal"
            enterKeyHint="done"
            aria-label="Precio unitario"
            className={celda}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className={etiquetaMovil}>Dto. %</span>
          <input
            value={descuento}
            onChange={(e) => setDescuento(e.target.value)}
            onBlur={() =>
              confirmarNumero(descuento, linea.descuento_pct, "descuento_pct", () =>
                setDescuento(texto(linea.descuento_pct)),
              )
            }
            onKeyDown={alPulsarEnter}
            inputMode="decimal"
            enterKeyHint="done"
            aria-label="Descuento"
            className={celda}
          />
        </label>
        <span className="col-span-2 flex items-center justify-between pt-esp1 text-right text-base font-semibold text-texto-primario md:col-span-1 md:justify-end md:pt-0 md:text-sm md:font-medium">
          <span className="text-xs font-normal text-texto-terciario md:hidden">Importe</span>
          {euros(linea.importe)}
        </span>
        <button
          disabled={pendiente}
          onClick={async () => {
            if (!(await confirmar(`¿Eliminar «${linea.descripcion}» del documento?`))) return;
            iniciar(async () => {
              try {
                await desenvolver(eliminarLinea(documentoId, linea.id));
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo eliminar.");
              }
            });
          }}
          aria-label="Eliminar línea"
          className="flex h-11 w-11 items-center justify-center justify-self-end text-icono-secundario hover:text-texto-peligro disabled:opacity-50 md:h-6 md:w-6"
        >
          <Icono nombre="eliminar" size={16} />
        </button>
      </div>
      {error && <p className="px-esp2 text-xs text-texto-peligro">{error}</p>}
    </div>
  );
}

function Etiqueta({
  texto: t,
  className,
  grupo,
  children,
}: {
  texto: string;
  className?: string;
  /** Grupo de botones: un <label> activaría el primero al tocar el título. */
  grupo?: boolean;
  children: React.ReactNode;
}) {
  const Contenedor = grupo ? "div" : "label";
  return (
    <Contenedor className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-texto-secundario">{t}</span>
      {children}
    </Contenedor>
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

// ---------------------------------------------------------------------
//  Concepto libre: algo que no está en el catálogo (o alta rápida al vuelo)
// ---------------------------------------------------------------------

const IVAS = [21, 10, 4, 0];

function FormularioLineaLibre({
  documento,
  categorias,
  artistas,
  descripcionInicial,
  onAnadido,
  onCancelar,
}: {
  documento: Cabecera;
  categorias: CategoriaOpcion[];
  artistas: string[];
  descripcionInicial?: string;
  onAnadido: () => void;
  onCancelar: () => void;
}) {
  const catPorDefecto =
    categorias.find((c) => normalizar(c.nombre).includes("servicio"))?.id ?? categorias[0]?.id ?? 0;

  const [descripcion, setDescripcion] = useState(descripcionInicial ?? "");
  const [artista, setArtista] = useState("");
  const [unidad, setUnidad] = useState("ud");
  const [cantidad, setCantidad] = useState("1");
  const [precio, setPrecio] = useState("");
  const [descuento, setDescuento] = useState(texto(documento.descuento_habitual));
  const [iva, setIva] = useState("21");
  const [guardarEnCatalogo, setGuardarEnCatalogo] = useState(false);
  const [categoriaId, setCategoriaId] = useState(catPorDefecto ? String(catPorDefecto) : "");
  const [alcanceCatalogo, setAlcanceCatalogo] = useState<Alcance>("instalacion");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const nCantidad = num(cantidad);
  const nPrecio = num(precio);
  const nDescuento = descuento.trim() === "" ? 0 : num(descuento);
  const importe =
    Number.isFinite(nCantidad) && Number.isFinite(nPrecio) && Number.isFinite(nDescuento)
      ? Math.round(nCantidad * nPrecio * (1 - nDescuento / 100) * 100) / 100
      : null;

  function anadir() {
    setError(null);
    if (!descripcion.trim()) return setError("Escribe el concepto.");
    if (!Number.isFinite(nCantidad) || nCantidad === 0) return setError("Indica la cantidad.");
    if (!Number.isFinite(nPrecio) || nPrecio < 0) return setError("Indica el precio unitario.");
    if (!Number.isFinite(nDescuento) || nDescuento < 0 || nDescuento > 100) return setError("El descuento va de 0 a 100 %.");
    if (guardarEnCatalogo && !categoriaId) return setError("Elige una categoría para guardarlo en el catálogo.");

    iniciar(async () => {
      try {
        await desenvolver(
          anadirLineaLibre(documento.id, {
            descripcion,
            artista,
            unidad,
            piezas: nCantidad,
            precio: nPrecio,
            descuento: nDescuento,
            iva: Number(iva),
            guardarEnCatalogo,
            categoriaId: guardarEnCatalogo ? Number(categoriaId) : undefined,
            alcanceCatalogo: guardarEnCatalogo ? alcanceCatalogo : undefined,
          }),
        );
        onAnadido();
        onCancelar();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo añadir el concepto.");
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5"
      onSubmit={(e) => {
        e.preventDefault();
        anadir();
      }}
    >
      <div>
        <h2 className="text-base font-semibold text-texto-primario">Añadir concepto libre</h2>
        <p className="text-sm text-texto-secundario">
          Para lo que no está en el catálogo (un desplazamiento, un trabajo suelto…). Puedes guardarlo también en tu
          catálogo para próximos documentos.
        </p>
      </div>
      <Etiqueta texto="Concepto *">
        <input
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          autoFocus={!descripcionInicial}
          placeholder="Ej. Desplazamiento a Marbella"
          className={entrada}
        />
      </Etiqueta>
      <div className="grid grid-cols-2 gap-esp3 md:grid-cols-4">
        <Etiqueta texto="Cantidad">
          <input value={cantidad} onChange={(e) => setCantidad(e.target.value)} inputMode="decimal" className={entrada} />
        </Etiqueta>
        <Etiqueta texto="Unidad">
          <select value={unidad} onChange={(e) => setUnidad(e.target.value)} className={entrada}>
            {Object.entries(UNIDAD).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </select>
        </Etiqueta>
        <Etiqueta texto="Precio unitario (€)">
          <input
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            autoFocus={Boolean(descripcionInicial)}
            inputMode="decimal"
            className={entrada}
          />
        </Etiqueta>
        <Etiqueta texto="Descuento (%)">
          <input value={descuento} onChange={(e) => setDescuento(e.target.value)} inputMode="decimal" className={entrada} />
        </Etiqueta>
        <Etiqueta texto="IVA">
          <select value={iva} onChange={(e) => setIva(e.target.value)} className={entrada}>
            {IVAS.map((v) => (
              <option key={v} value={v}>
                {v} %
              </option>
            ))}
          </select>
        </Etiqueta>
      </div>

      {categorias.length > 0 && (
        <div className="flex flex-col gap-esp3 rounded-md border border-borde-default bg-fondo-sutil/60 p-esp3">
          <label className="inline-flex cursor-pointer items-center gap-esp2 text-sm font-medium text-texto-primario">
            <input
              type="checkbox"
              checked={guardarEnCatalogo}
              onChange={(e) => setGuardarEnCatalogo(e.target.checked)}
              className="h-4 w-4"
            />
            Guardar también en el catálogo de productos y servicios
          </label>
          {guardarEnCatalogo && (
            <div className="grid grid-cols-1 gap-esp3 sm:grid-cols-2">
              <Etiqueta texto="Categoría del catálogo">
                <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)} className={entrada}>
                  {categorias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Etiqueta>
              <Etiqueta texto="Tipo de tarifa en el catálogo">
                <select
                  value={alcanceCatalogo}
                  onChange={(e) => setAlcanceCatalogo(e.target.value as Alcance)}
                  className={entrada}
                >
                  <option value="fabricacion">Fabricación / suministro</option>
                  <option value="instalacion">Instalación / servicio</option>
                  <option value="fabricacion_instalacion">Ambos (precio en fab.)</option>
                </select>
              </Etiqueta>
            </div>
          )}
        </div>
      )}

      <Etiqueta texto="Artista / referencia (opcional)" grupo>
        {artistas.length > 0 && (
          <div className="flex flex-wrap gap-esp2">
            {artistas.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setArtista(artista === a ? "" : a)}
                aria-pressed={artista === a}
                className={cn(
                  "min-h-10 rounded-completo border px-esp3 text-xs font-medium",
                  artista === a
                    ? "border-borde-foco bg-fondo-marca-sutil text-texto-marca"
                    : "border-borde-campo bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil",
                )}
              >
                {a}
              </button>
            ))}
          </div>
        )}
        <input value={artista} onChange={(e) => setArtista(e.target.value)} className={entrada} />
      </Etiqueta>
      {error && <p className="text-sm text-texto-peligro">{error}</p>}
      <div className="flex items-center gap-esp3 border-t border-fondo-hover pt-esp3">
        <div className="flex-1">
          <p className="text-xs text-texto-terciario">Importe de la línea</p>
          <p className="text-lg font-semibold text-texto-primario">{importe != null ? euros(importe) : "—"}</p>
        </div>
        <Boton type="button" variante="secundario" className="min-h-11" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" className="min-h-11" cargando={pendiente}>
          <Icono nombre="mas" size={16} />
          Añadir
        </Boton>
      </div>
    </form>
  );
}
