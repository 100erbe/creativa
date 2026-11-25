"use client";

import { useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { Insignia } from "@/components/ui/insignia";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { confirmar } from "@/components/ui/dialogos";
import { cn } from "@/lib/cn";
import { desenvolver } from "@/lib/accion";
import { euros } from "@/lib/formato";
import { useAccion } from "@/lib/use-accion";
import { Ocultable, eliminarOptimista } from "@/lib/eliminacion-optimista";
import { eliminarFormato, guardarFormato, guardarProducto } from "./acciones";
import { UNIDAD_CORTA, IVAS, aNumero, aTexto, etiquetaMini } from "./catalogo-comun";
import type { FormatoAdmin, ProductoAdmin } from "./catalogo-comun";

export function FilaProducto({
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
              <Ocultable key={`${f.id}-${f.codigo}-${f.nombre}-${f.anchoCm}-${f.altoCm}-${f.precioFabricacion}-${f.precioInstalacion}-${f.alias.join(",")}-${f.activo}`} clave={`formato:${f.id}`}>
                <FormularioFormato
                  productoId={p.id}
                  formato={f}
                  unidad={unidad}
                  permiteFab={p.permiteFabricacion}
                  permiteInst={p.permiteInstalacion}
                />
              </Ocultable>
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
  const { router, pendiente, error, setError, ejecutar } = useAccion({ refrescar: true });
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
              if (await eliminarOptimista(`formato:${f.id}`, () => desenvolver(eliminarFormato(f.id)))) router.refresh();
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
