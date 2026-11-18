"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Boton } from "@/components/ui/boton";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { desenvolver } from "@/lib/accion";
import { euros } from "@/lib/formato";
import { actualizarFormato, actualizarProducto } from "./acciones";

type FormatoAjuste = {
  id: number;
  nombre: string;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  activo: boolean;
};

export type ProductoAjuste = {
  id: number;
  codigo: string;
  nombre: string;
  unidad: string;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  ivaPct: number;
  activo: boolean;
  categoria: string;
  ordenCategoria: number;
  formatos: FormatoAjuste[];
};

const UNIDAD: Record<string, string> = { ud: "ud", m2: "m²", ml: "ml", millar: "millar", mes: "mes", servicio: "servicio", km: "km" };

/** "12,5" → 12.5; vacío → null; texto raro → NaN */
function aNumero(v: string): number | null {
  const t = v.trim().replace(/\s|€/g, "");
  if (t === "") return null;
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
}
const aTexto = (n: number | null) => (n == null ? "" : String(n).replace(".", ","));

export function Catalogo({ productos }: { productos: ProductoAjuste[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [verInactivos, setVerInactivos] = useState(false);

  const grupos = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const filtrados = productos.filter(
      (p) => (verInactivos || p.activo) && (!q || `${p.nombre} ${p.codigo} ${p.categoria}`.toLowerCase().includes(q)),
    );
    const mapa = new Map<string, ProductoAjuste[]>();
    for (const p of filtrados) mapa.set(p.categoria, [...(mapa.get(p.categoria) ?? []), p]);
    return [...mapa.entries()];
  }, [productos, busqueda, verInactivos]);

  return (
    <div className="flex flex-col gap-esp4">
      <div className="flex flex-wrap items-center gap-esp3">
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar producto o código…"
          aria-label="Buscar en el catálogo"
          className={`${CAMPO} max-w-xs`}
        />
        <label className="flex items-center gap-esp2 text-sm text-texto-secundario">
          <input type="checkbox" checked={verInactivos} onChange={(e) => setVerInactivos(e.target.checked)} />
          Ver inactivos
        </label>
      </div>

      {grupos.map(([categoria, lista]) => (
        <section key={categoria} className="flex flex-col gap-esp2">
          <h2 className="text-xs font-medium uppercase tracking-wide text-texto-terciario">{categoria}</h2>
          <div className="flex flex-col divide-y divide-borde-default rounded-xl border border-borde-default bg-fondo-superficie">
            {lista.map((p) => (
              <Producto key={`${p.id}-${p.precioFabricacion}-${p.precioInstalacion}-${p.ivaPct}-${p.activo}-${p.nombre}`} producto={p} />
            ))}
          </div>
        </section>
      ))}
      {grupos.length === 0 && <p className="text-sm text-texto-terciario">No hay productos con este filtro.</p>}
    </div>
  );
}

function useAccion() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  function ejecutar(fn: () => Promise<void>) {
    setError(null);
    setGuardado(false);
    iniciar(async () => {
      try {
        await fn();
        setGuardado(true);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo guardar.");
      }
    });
  }
  return { pendiente, error, guardado, ejecutar };
}

const mini = "flex flex-col gap-1 text-xs font-medium text-texto-secundario";

function Producto({ producto: p }: { producto: ProductoAjuste }) {
  const { pendiente, error, guardado, ejecutar } = useAccion();
  const [nombre, setNombre] = useState(p.nombre);
  const [fab, setFab] = useState(aTexto(p.precioFabricacion));
  const [inst, setInst] = useState(aTexto(p.precioInstalacion));
  const [iva, setIva] = useState(String(p.ivaPct));
  const [activo, setActivo] = useState(p.activo);

  return (
    <details className="group">
      <summary className="flex cursor-pointer list-none items-center gap-esp3 px-esp4 py-esp3 hover:bg-fondo-sutil">
        <div className="min-w-0 flex-1">
          <p className={`truncate text-sm font-medium ${p.activo ? "text-texto-primario" : "text-texto-terciario"}`}>
            {p.nombre}
            {!p.activo && <span className="ml-esp2 text-xs font-normal">inactivo</span>}
          </p>
          <p className="truncate text-xs text-texto-terciario">
            {p.codigo} · por {UNIDAD[p.unidad] ?? p.unidad}
            {p.formatos.length > 0 ? ` · ${p.formatos.length} formatos` : ""}
          </p>
        </div>
        <span className="hidden text-xs text-texto-secundario sm:block">
          {p.precioFabricacion != null ? `fab. ${euros(p.precioFabricacion)}` : "fab. —"} ·{" "}
          {p.precioInstalacion != null ? `inst. ${euros(p.precioInstalacion)}` : "inst. —"}
        </span>
        <span className="text-xs font-medium text-texto-marca group-open:hidden">Editar</span>
        <span className="hidden text-xs font-medium text-texto-secundario group-open:block">Cerrar</span>
      </summary>

      <div className="flex flex-col gap-esp4 border-t border-fondo-hover bg-fondo-sutil px-esp4 py-esp4">
        <form
          className="flex flex-col gap-esp3"
          onSubmit={(e) => {
            e.preventDefault();
            const nFab = aNumero(fab);
            const nInst = aNumero(inst);
            ejecutar(async () => {
              await desenvolver(
                actualizarProducto(p.id, {
                  nombre,
                  precioFabricacion: nFab,
                  precioInstalacion: nInst,
                  ivaPct: Number(iva),
                  activo,
                }),
              );
            });
          }}
        >
          <label className={mini}>
            Nombre
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={CAMPO} />
          </label>
          <div className="grid grid-cols-2 gap-esp3 sm:grid-cols-4">
            <label className={mini}>
              Fabricación (€/{UNIDAD[p.unidad] ?? p.unidad})
              <input value={fab} onChange={(e) => setFab(e.target.value)} inputMode="decimal" className={CAMPO} />
            </label>
            <label className={mini}>
              Instalación (€/{UNIDAD[p.unidad] ?? p.unidad})
              <input value={inst} onChange={(e) => setInst(e.target.value)} inputMode="decimal" className={CAMPO} />
            </label>
            <label className={mini}>
              IVA
              <select value={iva} onChange={(e) => setIva(e.target.value)} className={CAMPO}>
                {[21, 10, 4, 0].map((v) => (
                  <option key={v} value={v}>
                    {v} %
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-end gap-esp2 pb-2 text-sm text-texto-primario">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
              Activo
            </label>
          </div>
          <div className="flex items-center gap-esp3">
            <Boton type="submit" tamano="s" cargando={pendiente}>
              Guardar producto
            </Boton>
            {guardado && !error && <span className="text-xs text-texto-exito">Guardado</span>}
          </div>
          {error && <p className="text-xs text-texto-peligro">{error}</p>}
        </form>

        {p.formatos.length > 0 && (
          <div className="flex flex-col gap-esp2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-texto-terciario">
              Formatos · precio propio (vacío = el del producto)
            </h3>
            {p.formatos.map((f) => (
              <Formato key={`${f.id}-${f.precioFabricacion}-${f.precioInstalacion}-${f.activo}`} formato={f} unidad={UNIDAD[p.unidad] ?? p.unidad} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function Formato({ formato: f, unidad }: { formato: FormatoAjuste; unidad: string }) {
  const { pendiente, error, guardado, ejecutar } = useAccion();
  const [fab, setFab] = useState(aTexto(f.precioFabricacion));
  const [inst, setInst] = useState(aTexto(f.precioInstalacion));
  const [activo, setActivo] = useState(f.activo);

  return (
    <form
      className="flex flex-col gap-esp2 rounded-md border border-borde-default bg-fondo-superficie p-esp3"
      onSubmit={(e) => {
        e.preventDefault();
        ejecutar(async () => {
          await desenvolver(
            actualizarFormato(f.id, { precioFabricacion: aNumero(fab), precioInstalacion: aNumero(inst), activo }),
          );
        });
      }}
    >
      <p className={`text-sm font-medium ${activo ? "text-texto-primario" : "text-texto-terciario"}`}>{f.nombre}</p>
      <div className="grid grid-cols-2 items-end gap-esp2 sm:grid-cols-[1fr_1fr_auto_auto]">
        <label className={mini}>
          Fab. (€/{unidad})
          <input value={fab} onChange={(e) => setFab(e.target.value)} inputMode="decimal" className={CAMPO} />
        </label>
        <label className={mini}>
          Inst. (€/{unidad})
          <input value={inst} onChange={(e) => setInst(e.target.value)} inputMode="decimal" className={CAMPO} />
        </label>
        <label className="flex items-center gap-esp2 pb-2 text-sm text-texto-primario">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Activo
        </label>
        <Boton type="submit" tamano="s" variante="secundario" cargando={pendiente}>
          Guardar
        </Boton>
      </div>
      {guardado && !error && <p className="text-xs text-texto-exito">Guardado</p>}
      {error && <p className="text-xs text-texto-peligro">{error}</p>}
    </form>
  );
}
