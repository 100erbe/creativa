"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { euros } from "@/lib/formato";
import { ETIQUETA_ALCANCE } from "@/lib/documentos";
import { anadirLinea, previsualizarPrecio } from "./acciones";
import { desenvolver } from "@/lib/accion";
import { UNIDAD, num, texto, normalizar, alcancesDe, calcularCantidadLocal, calcularPrecioBaseLocal, entrada, Etiqueta } from "./lineas-comun";
import type { Alcance, Cabecera, FormatoCatalogo, ProductoCatalogo, CategoriaOpcion, Reciente } from "./lineas-comun";
import { FormularioLineaLibre } from "./formulario-linea-libre";

export function FormularioArticulo({
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
    <div className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
      <div>
        <h2 className="text-titulo-panel text-texto-primario">Añadir artículo</h2>
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
                    ? "bg-fondo-marca-sutil text-texto-marca"
                    : "bg-fondo-sutil text-texto-secundario hover:bg-fondo-hover hover:text-texto-primario",
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
                        ? "bg-fondo-marca-sutil text-texto-marca"
                        : "bg-fondo-sutil text-texto-secundario hover:bg-fondo-hover hover:text-texto-primario",
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
              <div className="flex max-h-96 flex-col divide-y divide-borde-default overflow-y-auto rounded-xl border border-borde-default bg-fondo-superficie shadow-sm">
                {resultados.map(([categoria, productos]) => (
                  <div key={categoria} className="flex flex-col">
                    <span className="sticky top-0 z-10 border-b border-fondo-hover bg-fondo-sutil/95 px-esp3 py-1.5 text-etiqueta uppercase text-texto-secundario backdrop-blur-sm">
                      {categoria}
                    </span>
                    <div className="flex flex-col divide-y divide-borde-default">
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
                                      className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-borde-campo bg-fondo-superficie px-esp2 py-1 text-xs text-texto-primario transition-colors hover:border-borde-foco hover:bg-fondo-marca-sutil hover:text-texto-marca"
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

            <Etiqueta texto={conMedidas ? "Unidades" : `Cantidad (${UNIDAD[producto.unidad] ?? producto.unidad})`}>
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
