"use client";

import { useEffect, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { confirmar } from "@/components/ui/dialogos";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";
import { eliminarOptimista } from "@/lib/eliminacion-optimista";
import { eliminarProducto, guardarProducto } from "./acciones";
import { atraparFoco } from "@/lib/trampa-foco";
import { euros } from "@/lib/formato";
import { calcularMargen } from "@/lib/margen";
import { InsigniaMargen } from "@/components/ui/insignia-margen";
import { UNIDAD_CORTA, UNIDADES_OPCIONES, IVAS, aNumero, aTexto, etiquetaMini } from "./catalogo-comun";
import type { CategoriaAdmin, ProductoAdmin } from "./catalogo-comun";

export function ModalProducto({
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
  const { router, pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });

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
  const [costeFab, setCosteFab] = useState(aTexto(p?.costeFabricacion ?? null));
  const [costeInst, setCosteInst] = useState(aTexto(p?.costeInstalacion ?? null));
  const [pedidoMinimo, setPedidoMinimo] = useState(aTexto(p?.pedidoMinimo ?? null));
  const [ivaPct, setIvaPct] = useState(String(p?.ivaPct ?? 21));
  const [descripcionFactura, setDescripcionFactura] = useState(p?.descripcionFactura ?? "");
  const [material, setMaterial] = useState(p?.material ?? "");
  const [notas, setNotas] = useState(p?.notas ?? "");
  const [activo, setActivo] = useState(p?.activo ?? true);

  const esSuperficie = unidadVenta === "m2" || unidadVenta === "ml";
  const unidadCorta = UNIDAD_CORTA[unidadVenta] ?? unidadVenta;

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
          const cFab = permiteFabricacion ? aNumero(costeFab) : null;
          const cInst = permiteInstalacion ? aNumero(costeInst) : null;
          if (cFab != null && (!Number.isFinite(cFab) || cFab < 0)) return setError("El coste de fabricación no es válido.");
          if (cInst != null && (!Number.isFinite(cInst) || cInst < 0)) return setError("El coste de instalación no es válido.");

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
                costeFabricacion: cFab,
                costeInstalacion: cInst,
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

        {/* Coste interno: solo para el margen bruto, nunca visible para el cliente */}
        <div className="flex flex-col gap-esp3 rounded-lg border border-borde-default bg-fondo-sutil/60 p-esp3">
          <div className="flex flex-col gap-0.5">
            <p className="flex items-center gap-esp2 text-xs font-semibold uppercase tracking-wide text-texto-terciario">
              Coste interno y margen
            </p>
            <p className="text-xs text-texto-terciario">
              Coste aproximado (material, accesorios y mano de obra). Solo lo ves tú: no aparece en documentos, PDF ni emails.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-esp3 sm:grid-cols-2">
            <CampoCoste
              etiqueta={`Coste fabricación (€/${unidadCorta})`}
              valor={costeFab}
              onCambio={setCosteFab}
              precio={permiteFabricacion ? aNumero(precioFab) : null}
              disabled={!permiteFabricacion}
              placeholder={p?.formatos.length ? "Vacío = según formato" : "Ej. 12,00"}
            />
            <CampoCoste
              etiqueta={`Coste instalación (€/${unidadCorta})`}
              valor={costeInst}
              onCambio={setCosteInst}
              precio={permiteInstalacion ? aNumero(precioInst) : null}
              disabled={!permiteInstalacion}
              placeholder="Ej. 3,00"
            />
          </div>
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
                onCerrar();
                if (await eliminarOptimista(`producto:${p.id}`, () => desenvolver(eliminarProducto(p.id)))) {
                  router.refresh();
                }
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

/** Campo de coste con el margen resultante frente al precio base (si ambos están definidos). */
function CampoCoste({
  etiqueta,
  valor,
  onCambio,
  precio,
  disabled,
  placeholder,
}: {
  etiqueta: string;
  valor: string;
  onCambio: (v: string) => void;
  precio: number | null;
  disabled: boolean;
  placeholder: string;
}) {
  const coste = aNumero(valor);
  const margen =
    !disabled && precio != null && Number.isFinite(precio) && coste != null && Number.isFinite(coste)
      ? calcularMargen(precio, coste)
      : null;
  return (
    <div className="flex flex-col gap-1">
      <label className={etiquetaMini}>
        {etiqueta}
        <input
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          disabled={disabled}
          inputMode="decimal"
          placeholder={placeholder}
          className={CAMPO}
        />
      </label>
      {margen && (
        <p className="flex items-center gap-esp2 text-xs text-texto-secundario" aria-live="polite">
          <InsigniaMargen pct={margen.pct} />
          Beneficio {euros(margen.beneficio)} por unidad
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
//  Modal de creación / edición de Categoría
// ---------------------------------------------------------------------
