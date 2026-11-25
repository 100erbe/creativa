"use client";

import { useEffect, useRef, useState } from "react";
import { Boton, clasesBoton } from "@/components/ui/boton";
import { atraparFoco } from "@/lib/trampa-foco";

// Sustituye a window.confirm / window.alert: tienen el aspecto de la app, no se bloquean en el
// navegador del móvil instalado como PWA y no tapan la pantalla con el rótulo del navegador.
//
// Uso (desde cualquier componente cliente, sin hooks):
//   if (!(await confirmar("¿Eliminar este punto?"))) return;
//   void avisar("No se pudo subir la foto.");
// y un único <Dialogos /> montado en el layout raíz.

type Peticion =
  | { tipo: "confirmar"; texto: string; aceptar: string; peligro: boolean; resolver: (v: boolean) => void }
  | { tipo: "avisar"; texto: string; resolver: () => void };

type Escucha = (p: Peticion) => void;
let escucha: Escucha | null = null;

const PALABRAS_PELIGRO = /eliminar|borrar|no se puede deshacer|desactivar/i;

export type OpcionesConfirmar = {
  /** Texto del botón de aceptar (por defecto «Aceptar», o «Eliminar» si el texto habla de eliminar). */
  aceptar?: string;
  /** Botón rojo. Por defecto se deduce del texto. */
  peligro?: boolean;
};

export function confirmar(texto: string, opciones: OpcionesConfirmar = {}): Promise<boolean> {
  const peligro = opciones.peligro ?? PALABRAS_PELIGRO.test(texto);
  const aceptar = opciones.aceptar ?? (peligro && /eliminar|borrar/i.test(texto) ? "Eliminar" : "Aceptar");
  return new Promise((resolver) => {
    // Sin <Dialogos /> montado (no debería pasar) se cae al cuadro del navegador.
    if (!escucha) return resolver(window.confirm(texto));
    escucha({ tipo: "confirmar", texto, aceptar, peligro, resolver });
  });
}

export function avisar(texto: string): Promise<void> {
  return new Promise((resolver) => {
    if (!escucha) {
      window.alert(texto);
      return resolver();
    }
    escucha({ tipo: "avisar", texto, resolver });
  });
}

export function Dialogos() {
  const [cola, setCola] = useState<Peticion[]>([]);
  const botonAceptar = useRef<HTMLButtonElement>(null);
  const actual = cola[0];

  useEffect(() => {
    escucha = (p) => setCola((c) => [...c, p]);
    return () => {
      escucha = null;
    };
  }, []);

  // Foco en el botón principal al abrirse y Escape = cancelar.
  useEffect(() => {
    if (!actual) return;
    botonAceptar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === "Escape") cerrar(false);
    };
    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actual]);

  function cerrar(aceptado: boolean) {
    if (!actual) return;
    if (actual.tipo === "confirmar") actual.resolver(aceptado);
    else actual.resolver();
    setCola((c) => c.slice(1));
  }

  if (!actual) return null;

  const [titulo, ...resto] = actual.texto.split(/\n+/);
  const detalle = resto.join("\n");

  return (
    <div className="fixed inset-0 z-[10010] flex items-end justify-center p-esp4 sm:items-center" role="presentation">
      <button
        type="button"
        aria-label="Cancelar"
        tabIndex={-1}
        onClick={() => cerrar(false)}
        className="animate-velo-entrar absolute inset-0 cursor-default bg-fondo-velo"
      />
      <div ref={atraparFoco}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dialogo-titulo"
        aria-describedby={detalle ? "dialogo-detalle" : undefined}
        className="animate-hoja-subir sm:animate-modal-entrar relative flex w-full max-w-sm flex-col gap-esp4 rounded-xl border border-borde-default bg-fondo-superficie p-esp5 shadow-elevado md:p-esp6"
      >
        <div className="flex flex-col gap-esp2">
          <p id="dialogo-titulo" className="text-destacado text-texto-primario">
            {titulo}
          </p>
          {detalle && (
            <p id="dialogo-detalle" className="whitespace-pre-line text-cuerpo text-texto-secundario">
              {detalle}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-esp2">
          {actual.tipo === "confirmar" && (
            <Boton type="button" variante="secundario" className="flex-1 sm:flex-none" onClick={() => cerrar(false)}>
              Cancelar
            </Boton>
          )}
          <button
            ref={botonAceptar}
            type="button"
            onClick={() => cerrar(true)}
            className={clasesBoton(
              actual.tipo === "confirmar" && actual.peligro ? "peligro" : "primario",
              "m",
              "flex-1 sm:flex-none",
            )}
          >
            {actual.tipo === "confirmar" ? actual.aceptar : "Entendido"}
          </button>
        </div>
      </div>
    </div>
  );
}
