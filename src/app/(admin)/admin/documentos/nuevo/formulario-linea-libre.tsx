"use client";

import { useState, useTransition } from "react";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { cn } from "@/lib/cn";
import { euros } from "@/lib/formato";
import { anadirLineaLibre } from "./acciones";
import { desenvolver } from "@/lib/accion";
import { UNIDAD, num, texto, normalizar, entrada, Etiqueta, IVAS } from "./lineas-comun";
import type { Alcance, Cabecera, CategoriaOpcion } from "./lineas-comun";
import { InsigniaMargen } from "@/components/ui/insignia-margen";
import { baseNetaLinea, calcularMargen } from "@/lib/margen";
import { useMargenesVisibles } from "@/lib/margenes-visibles";

export function FormularioLineaLibre({
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
  const [coste, setCoste] = useState("");
  const margenesVisibles = useMargenesVisibles();
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
  const nCoste = coste.trim() === "" ? null : num(coste);
  const costeLinea =
    nCoste != null && Number.isFinite(nCoste) && Number.isFinite(nCantidad)
      ? Math.round(nCantidad * nCoste * 100) / 100
      : null;
  const margen =
    importe != null && costeLinea != null
      ? calcularMargen(baseNetaLinea(importe, documento.descuento_global_pct), costeLinea)
      : null;

  function anadir() {
    setError(null);
    if (!descripcion.trim()) return setError("Escribe el concepto.");
    if (!Number.isFinite(nCantidad) || nCantidad === 0) return setError("Indica la cantidad.");
    if (!Number.isFinite(nPrecio) || nPrecio < 0) return setError("Indica el precio unitario.");
    if (!Number.isFinite(nDescuento) || nDescuento < 0 || nDescuento > 100) return setError("El descuento va de 0 a 100 %.");
    if (guardarEnCatalogo && !categoriaId) return setError("Elige una categoría para guardarlo en el catálogo.");
    if (nCoste != null && (!Number.isFinite(nCoste) || nCoste < 0)) return setError("Indica un coste válido o déjalo vacío.");

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
            coste: nCoste,
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
      className="flex flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie px-esp6 py-esp5"
      onSubmit={(e) => {
        e.preventDefault();
        anadir();
      }}
    >
      <div>
        <h2 className="text-titulo-panel text-texto-primario">Añadir concepto libre</h2>
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

      {margenesVisibles && (
        <div className="flex flex-wrap items-end gap-esp3 rounded-lg border border-dashed border-borde-default bg-fondo-sutil/60 p-esp3">
          <Etiqueta texto="Coste interno unitario (€)" className="w-40">
            <input
              value={coste}
              onChange={(e) => setCoste(e.target.value)}
              inputMode="decimal"
              placeholder="Sin coste"
              className={entrada}
            />
          </Etiqueta>
          <div className="flex min-h-11 flex-1 items-center text-xs text-texto-secundario" aria-live="polite">
            {margen ? (
              <span className="flex flex-wrap items-center gap-esp2">
                <InsigniaMargen pct={margen.pct} />
                <span>
                  Beneficio <strong className="text-texto-primario">{euros(margen.beneficio)}</strong> · coste{" "}
                  {euros(costeLinea ?? 0)}
                </span>
              </span>
            ) : (
              <span className="text-texto-terciario">Opcional: un coste aproximado para ver el margen.</span>
            )}
          </div>
        </div>
      )}

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
