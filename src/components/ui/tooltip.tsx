"use client";

import { cloneElement, isValidElement, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

// Tooltip del sistema "Documentos": fondo inverso (#282A3D), radio 12, padding 8/12, texto 12/18 blanco.
// Aparece encima del disparador (a 46 px en la insignia de estado de Figma) con un fundido corto.
// Se abre con el ratón, con el foco del teclado y con un toque (pantallas táctiles); Escape lo cierra.
// El disparador recibe aria-describedby apuntando al texto.

type Alineacion = "inicio" | "centro" | "fin";

const ALINEACION: Record<Alineacion, string> = {
  inicio: "left-0",
  centro: "left-1/2 -translate-x-1/2",
  fin: "right-0",
};

export function Tooltip({
  texto,
  children,
  alineacion = "centro",
  className,
}: {
  texto: React.ReactNode;
  /** Un único elemento interactivo (botón o enlace). */
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  alineacion?: Alineacion;
  className?: string;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  // Un toque fuera lo cierra (en táctil no hay «mouse leave»).
  useEffect(() => {
    if (!visible) return;
    const fuera = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setVisible(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setVisible(false);
    document.addEventListener("pointerdown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("pointerdown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [visible]);

  const disparador = isValidElement(children) ? cloneElement(children, { "aria-describedby": id }) : children;

  return (
    <span
      ref={ref}
      className={cn("relative inline-flex", className)}
      onPointerEnter={(e) => e.pointerType === "mouse" && setVisible(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setVisible(false)}
      onPointerUp={(e) => e.pointerType !== "mouse" && setVisible((v) => !v)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {disparador}
      <span
        id={id}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute bottom-full z-30 mb-esp3 whitespace-nowrap rounded-lg bg-fondo-inverso px-esp3 py-esp2 text-etiqueta text-texto-inverso transition-opacity duration-rapida ease-salida",
          ALINEACION[alineacion],
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        {texto}
      </span>
    </span>
  );
}
