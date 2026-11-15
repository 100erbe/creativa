"use client";

import { useEffect, useRef, useState } from "react";
import { Boton } from "@/components/ui/boton";

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

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-esp4 sm:items-center" role="presentation">
      <button
        aria-label="Cancelar"
        tabIndex={-1}
        onClick={() => cerrar(false)}
        className="absolute inset-0 cursor-default bg-black/40"
      />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-describedby="dialogo-texto"
        className="relative flex w-full max-w-sm flex-col gap-esp4 rounded-lg bg-fondo-superficie p-esp5 shadow-xl"
      >
        <p id="dialogo-texto" className="whitespace-pre-line text-sm text-texto-primario">
          {actual.texto}
        </p>
        <div className="flex justify-end gap-esp2">
          {actual.tipo === "confirmar" && (
            <Boton variante="secundario" className="min-h-11 flex-1 sm:flex-none" onClick={() => cerrar(false)}>
              Cancelar
            </Boton>
          )}
          <button
            ref={botonAceptar}
            onClick={() => cerrar(true)}
            className={`inline-flex h-10 min-h-11 flex-1 items-center justify-center rounded-md px-esp4 text-sm font-medium transition-colors sm:flex-none ${
              actual.tipo === "confirmar" && actual.peligro
                ? "bg-fondo-peligro text-texto-inverso hover:bg-fondo-peligro-hover"
                : "bg-fondo-marca text-texto-sobre-marca hover:bg-fondo-marca-hover"
            }`}
          >
            {actual.tipo === "confirmar" ? actual.aceptar : "Entendido"}
          </button>
        </div>
      </div>
    </div>
  );
}
