"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasosDocumento } from "@/components/admin/pasos-documento";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { euros } from "@/lib/formato";
import { ETIQUETA_ALCANCE, ETIQUETA_TIPO } from "@/lib/documentos";
import {
  actualizarLinea,
  anadirLinea,
  eliminarLinea,
  previsualizarPrecio,
} from "./acciones";

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

export type ProductoCatalogo = {
  id: number;
  nombre: string;
  unidad: string;
  medidaLibre: boolean;
  fabricacion: boolean;
  instalacion: boolean;
  categoria: string;
  ordenCategoria: number;
  formatos: { id: number; nombre: string; ancho: number | null; alto: number | null }[];
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

function alcancesDe(p: ProductoCatalogo): Alcance[] {
  if (p.fabricacion && p.instalacion) return ["fabricacion_instalacion", "fabricacion", "instalacion"];
  if (p.fabricacion) return ["fabricacion"];
  if (p.instalacion) return ["instalacion"];
  return ["fabricacion_instalacion"];
}

export function PasoLineas({
  documento,
  lineas,
  catalogo,
  recientes,
}: {
  documento: Cabecera;
  lineas: Linea[];
  catalogo: ProductoCatalogo[];
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
              <span className="text-[28px] font-semibold leading-9 text-texto-primario">
                {euros(documento.total)}
              </span>
            </div>
            <div className="mt-esp2 flex gap-esp3">
              <Boton
                variante="secundario"
                onClick={() => router.push(`/admin/documentos/nuevo?documento=${documento.id}&paso=cliente`)}
              >
                Atrás
              </Boton>
              <Boton
                className="flex-1"
                disabled={lineas.length === 0}
                onClick={() => router.push(`/admin/documentos/nuevo?documento=${documento.id}&paso=campana`)}
              >
                Continuar
              </Boton>
            </div>
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
//  Formulario para añadir un artículo del catálogo
// ---------------------------------------------------------------------

const entrada =
  "h-9 w-full rounded-md border border-borde-fuerte bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none focus:border-borde-foco disabled:bg-fondo-sutil disabled:opacity-60";

function FormularioArticulo({
  documento,
  catalogo,
  artistas,
  recientes,
  onAnadido,
}: {
  documento: Cabecera;
  catalogo: ProductoCatalogo[];
  artistas: string[];
  recientes: (Reciente & { etiqueta: string })[];
  onAnadido: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
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

  const producto = catalogo.find((p) => p.id === productoId) ?? null;
  const conMedidas = producto?.unidad === "m2" || producto?.unidad === "ml";

  const resultados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = q
      ? catalogo.filter((p) =>
          `${p.nombre} ${p.categoria} ${p.formatos.map((f) => f.nombre).join(" ")}`.toLowerCase().includes(q),
        )
      : catalogo;
    const grupos = new Map<string, ProductoCatalogo[]>();
    for (const p of lista) grupos.set(p.categoria, [...(grupos.get(p.categoria) ?? []), p]);
    return [...grupos.entries()];
  }, [busqueda, catalogo]);

  function elegirProducto(p: ProductoCatalogo, opciones?: { formatoId?: number | null; alcance?: string; precio?: number; descuento?: number }) {
    setProductoId(p.id);
    const f = p.formatos.find((x) => x.id === opciones?.formatoId) ?? (p.formatos.length === 1 ? p.formatos[0] : undefined);
    setFormatoId(f?.id ?? null);
    const permitidos = alcancesDe(p);
    setAlcance(permitidos.includes(opciones?.alcance as Alcance) ? (opciones!.alcance as Alcance) : permitidos[0]!);
    setPiezas("1");
    setAncho(f?.ancho != null ? texto(f.ancho) : "");
    setAlto(f?.alto != null ? texto(f.alto) : "");
    setDescripcion("");
    setError(null);
    if (opciones?.precio != null) {
      setPrecio(texto(opciones.precio, 4));
      setPrecioManual(true);
    } else {
      setPrecioManual(false);
    }
    setDescuento(texto(opciones?.descuento ?? documento.descuento_habitual));
    setBusqueda("");
    setAbierto(false);
  }

  function elegirFormato(id: number | null) {
    setFormatoId(id);
    const f = producto?.formatos.find((x) => x.id === id);
    if (f?.ancho != null && f.alto != null) {
      setAncho(texto(f.ancho));
      setAlto(texto(f.alto));
    }
  }

  // Precio de tarifa: se recalcula al cambiar producto, formato, alcance, cantidad o medidas.
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
        const r = await previsualizarPrecio({
          clienteId: documento.cliente_id,
          productoId: producto.id,
          formatoId,
          alcance,
          piezas: nPiezas,
          anchoCm: medidas ? nAncho : null,
          altoCm: medidas ? nAlto : null,
        });
        if (cancelado) return;
        setTarifa(r);
        if (!precioManual) setPrecio(texto(r.precio, 4));
      } catch {
        if (!cancelado) setTarifa(null);
      } finally {
        if (!cancelado) setCalculando(false);
      }
    }, 250);
    return () => {
      cancelado = true;
      clearTimeout(t);
    };
    // precioManual a propósito fuera: al restaurar la tarifa se fuerza abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [producto?.id, formatoId, alcance, nPiezas, nAncho, nAlto, documento.cliente_id]);

  const nPrecio = num(precio);
  const nDescuento = descuento.trim() === "" ? 0 : num(descuento);
  const cantidad = tarifa?.cantidad ?? nPiezas;
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
    if (conMedidas && (Number.isFinite(nAncho) !== Number.isFinite(nAlto)))
      return setError("Indica ancho y alto, o deja los dos vacíos.");

    iniciar(async () => {
      try {
        await anadirLinea(documento.id, {
          productoId: producto.id,
          formatoId,
          alcance,
          piezas: nPiezas,
          anchoCm: medidas ? nAncho : null,
          altoCm: medidas ? nAlto : null,
          // Si coincide con la tarifa se deja que la base de datos la aplique.
          precio: distintoDeTarifa || !tarifa ? nPrecio : null,
          descuento: nDescuento,
          descripcion,
          artista,
        });
        setProductoId(null);
        setTarifa(null);
        onAnadido();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo añadir el artículo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-esp4 rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
      <div>
        <h2 className="text-base font-semibold text-texto-primario">Añadir artículo</h2>
        <p className="text-sm text-texto-secundario">
          El precio sale de la tarifa del cliente; puedes cambiarlo a mano y aplicar un descuento.
        </p>
      </div>

      {!producto && (
        <>
          {recientes.length > 0 && (
            <div className="flex flex-col gap-esp2">
              <div className="flex items-center gap-esp2">
                <Icono nombre="reloj" size={14} className="text-icono-secundario" />
                <span className="text-xs font-medium text-texto-terciario">
                  USADO RECIENTEMENTE CON ESTE CLIENTE
                </span>
              </div>
              <div className="flex flex-wrap gap-esp2">
                {recientes.map((r, i) => (
                  <button
                    key={`${r.producto_id}-${r.formato_id}-${r.alcance}-${i}`}
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
                    className="flex items-center gap-1 rounded-completo border border-borde-fuerte bg-fondo-superficie px-esp3 py-1.5 text-xs font-medium text-texto-primario hover:bg-fondo-sutil"
                  >
                    <Icono nombre="mas" size={12} className="text-icono-marca" />
                    {r.etiqueta}
                    <span className="text-texto-terciario">· {euros(r.ultimo_precio)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="relative">
            <Icono
              nombre="buscar"
              size={16}
              className="pointer-events-none absolute left-esp3 top-1/2 -translate-y-1/2 text-icono-secundario"
            />
            <input
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setAbierto(true);
              }}
              onFocus={() => setAbierto(true)}
              onBlur={() => setAbierto(false)}
              placeholder="Buscar en el catálogo: lona, banderola, 70x100…"
              className={cn(entrada, "h-10 pl-9")}
            />
            {/* Desplegable flotante: no ocupa altura hasta que se busca o se abre. */}
            {abierto && (
          <div
            onMouseDown={(e) => e.preventDefault()}
            className="absolute inset-x-0 top-full z-20 mt-1 flex max-h-72 flex-col gap-esp3 overflow-y-auto rounded-md border border-borde-default bg-fondo-superficie p-esp2 shadow-lg"
          >
            {resultados.map(([categoria, productos]) => (
              <div key={categoria} className="flex flex-col gap-1">
                <span className="px-esp2 text-[11px] font-medium uppercase tracking-wide text-texto-terciario">
                  {categoria}
                </span>
                {productos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => elegirProducto(p)}
                    className="flex items-center gap-esp3 rounded-md px-esp2 py-1.5 text-left hover:bg-fondo-sutil"
                  >
                    <span className="flex-1 text-sm text-texto-primario">{p.nombre}</span>
                    {p.formatos.length > 0 && (
                      <span className="text-xs text-texto-terciario">{p.formatos.length} formatos</span>
                    )}
                    <span className="w-16 text-right text-xs text-texto-terciario">por {UNIDAD[p.unidad] ?? p.unidad}</span>
                  </button>
                ))}
              </div>
            ))}
            {resultados.length === 0 && (
              <p className="px-esp2 py-esp3 text-sm text-texto-terciario">Nada en el catálogo con «{busqueda}».</p>
            )}
          </div>
            )}
          </div>
        </>
      )}

      {producto && (
        <div className="flex flex-col gap-esp4">
          <div className="flex items-center gap-esp3 rounded-md bg-fondo-sutil px-esp3 py-esp2">
            <div className="flex-1">
              <p className="text-sm font-medium text-texto-primario">{producto.nombre}</p>
              <p className="text-xs text-texto-terciario">
                {producto.categoria} · se vende por {UNIDAD[producto.unidad] ?? producto.unidad}
              </p>
            </div>
            <button
              onClick={() => setProductoId(null)}
              className="text-sm font-medium text-texto-marca"
            >
              Cambiar artículo
            </button>
          </div>

          <div className="grid grid-cols-2 gap-esp3 md:grid-cols-4">
            {producto.formatos.length > 0 && (
              <Etiqueta texto="Formato" className="col-span-2">
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
              </Etiqueta>
            )}
            <Etiqueta texto="Alcance" className="col-span-2">
              <div className="flex h-9 overflow-hidden rounded-md border border-borde-fuerte">
                {alcancesDe(producto).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAlcance(a)}
                    className={cn(
                      "flex-1 px-esp2 text-xs font-medium",
                      alcance === a
                        ? "bg-fondo-marca text-texto-sobre-marca"
                        : "bg-fondo-superficie text-texto-secundario hover:bg-fondo-sutil",
                    )}
                  >
                    {ETIQUETA_ALCANCE[a]}
                  </button>
                ))}
              </div>
            </Etiqueta>

            <Etiqueta texto={conMedidas ? "Piezas" : `Cantidad (${UNIDAD[producto.unidad] ?? producto.unidad})`}>
              <input value={piezas} onChange={(e) => setPiezas(e.target.value)} inputMode="decimal" className={entrada} />
            </Etiqueta>
            {conMedidas && (
              <>
                <Etiqueta texto="Ancho (cm)">
                  <input value={ancho} onChange={(e) => setAncho(e.target.value)} inputMode="decimal" className={entrada} />
                </Etiqueta>
                <Etiqueta texto="Alto (cm)">
                  <input value={alto} onChange={(e) => setAlto(e.target.value)} inputMode="decimal" className={entrada} />
                </Etiqueta>
                <div className="flex flex-col justify-end pb-2 text-xs text-texto-terciario">
                  {tarifa && Number.isFinite(nAncho)
                    ? `= ${texto(tarifa.cantidad, 3)} ${UNIDAD[producto.unidad]}`
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
                className={cn(entrada, distintoDeTarifa && "border-borde-aviso bg-fondo-aviso-sutil")}
              />
            </Etiqueta>
            <Etiqueta texto="Descuento (%)">
              <input value={descuento} onChange={(e) => setDescuento(e.target.value)} inputMode="decimal" className={entrada} />
            </Etiqueta>
            <div className="col-span-2 flex flex-col justify-end gap-1 text-xs">
              {calculando ? (
                <span className="text-texto-terciario">Calculando tarifa…</span>
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

          <Etiqueta texto="Artista / referencia (opcional)">
            <input
              value={artista}
              onChange={(e) => setArtista(e.target.value)}
              list="artistas-documento"
              placeholder="Ej. Artista A — gira 2026"
              className={entrada}
            />
            <datalist id="artistas-documento">
              {artistas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <span className="text-xs text-texto-terciario">
              Sale en la factura debajo del concepto. Útil si el documento mezcla varios artistas.
            </span>
          </Etiqueta>

          <Etiqueta texto="Concepto en el documento (opcional)">
            <input
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder={`${producto.nombre}${formatoId ? ` · ${producto.formatos.find((f) => f.id === formatoId)?.nombre ?? ""}` : ""}`}
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
            <Boton variante="secundario" onClick={() => setProductoId(null)}>
              Cancelar
            </Boton>
            <Boton onClick={anadir} cargando={pendiente} disabled={calculando && !precioManual}>
              <Icono nombre="mas" size={16} />
              Añadir
            </Boton>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Tabla de líneas con edición en línea
// ---------------------------------------------------------------------

function TablaLineas({ documentoId, lineas }: { documentoId: number; lineas: Linea[] }) {
  return (
    <div className="flex flex-col gap-esp3 overflow-x-auto rounded-lg border border-borde-default bg-fondo-superficie px-esp6 py-esp5">
      <div>
        <h2 className="text-base font-semibold text-texto-primario">Artículos · {lineas.length}</h2>
        {lineas.length > 0 && (
          <p className="text-xs text-texto-terciario">Toca cantidad, precio o descuento para cambiarlos.</p>
        )}
      </div>
      <div className="grid min-w-[620px] grid-cols-[1fr_80px_100px_70px_100px_24px] gap-esp3 text-xs font-medium text-texto-terciario">
        <span>CONCEPTO</span>
        <span className="text-right">CANT.</span>
        <span className="text-right">PRECIO</span>
        <span className="text-right">DTO. %</span>
        <span className="text-right">IMPORTE</span>
        <span />
      </div>
      <div className="flex min-w-[620px] flex-col divide-y divide-fondo-hover">
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
        await actualizarLinea(documentoId, linea.id, cambios);
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
    "h-8 w-full rounded-md border border-transparent bg-transparent px-esp2 text-right text-sm text-texto-primario outline-none hover:border-borde-default focus:border-borde-foco focus:bg-fondo-superficie";
  const alPulsarEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") e.currentTarget.blur();
  };

  return (
    <div className={cn("flex flex-col py-esp2", pendiente && "opacity-60")}>
      <div className="grid grid-cols-[1fr_80px_100px_70px_100px_24px] items-center gap-esp3">
        <div className="min-w-0">
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
            className="h-7 w-full rounded-md border border-transparent bg-transparent px-esp2 text-left text-xs text-texto-secundario outline-none placeholder:text-texto-terciario hover:border-borde-default focus:border-borde-foco focus:bg-fondo-superficie"
          />
          {linea.cantidad !== linea.piezas && (
            <p className="px-esp2 text-xs text-texto-terciario">
              {texto(linea.piezas, 3)} pzs → {texto(linea.cantidad, 3)} {UNIDAD[linea.unidad] ?? linea.unidad}
            </p>
          )}
        </div>
        <input
          value={piezas}
          onChange={(e) => setPiezas(e.target.value)}
          onBlur={() => confirmarNumero(piezas, linea.piezas, "piezas", () => setPiezas(texto(linea.piezas, 3)))}
          onKeyDown={alPulsarEnter}
          inputMode="decimal"
          aria-label="Cantidad"
          className={celda}
        />
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
          aria-label="Precio unitario"
          className={celda}
        />
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
          aria-label="Descuento"
          className={celda}
        />
        <span className="text-right text-sm font-medium text-texto-primario">{euros(linea.importe)}</span>
        <button
          disabled={pendiente}
          onClick={() =>
            iniciar(async () => {
              try {
                await eliminarLinea(documentoId, linea.id);
                router.refresh();
              } catch (e) {
                setError(e instanceof Error ? e.message : "No se pudo eliminar.");
              }
            })
          }
          aria-label="Eliminar línea"
          className="text-icono-secundario hover:text-texto-peligro disabled:opacity-50"
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
  children,
}: {
  texto: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-texto-secundario">{t}</span>
      {children}
    </label>
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
