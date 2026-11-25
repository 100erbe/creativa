"use client";

import { useEffect, useState } from "react";
import { Boton } from "@/components/ui/boton";
import { Icono } from "@/components/ui/iconos";
import { CAMPO } from "@/components/ui/panel-busqueda";
import { desenvolver } from "@/lib/accion";
import { useAccion } from "@/lib/use-accion";
import { guardarCategoria } from "./acciones";
import { atraparFoco } from "@/lib/trampa-foco";
import { etiquetaMini } from "./catalogo-comun";
import type { CategoriaAdmin } from "./catalogo-comun";

export function ModalCategoria({
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
