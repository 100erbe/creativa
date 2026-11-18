"use client";

import { useEffect, useState } from "react";
import { Icono } from "@/components/ui/iconos";
import { Boton } from "@/components/ui/boton";
import { cn } from "@/lib/cn";

// Alerta con acciones ("Feedback / Dismissible alert" de Figma): fondo aviso-sutil, radio 12, padding 16.
// [icono alerta] [título 16/24 seminegrita + descripción 13/20] [«Ocultar» secundario] [acción principal]
// «Ocultar» la recoge durante la sesión del navegador (vuelve en la siguiente visita si el problema sigue).
export function AlertaDescartable({
  titulo,
  descripcion,
  accion,
  claveSesion,
  tono = "aviso",
  className,
}: {
  titulo: React.ReactNode;
  descripcion?: React.ReactNode;
  /** Acción principal (normalmente un enlace con aspecto de botón primario). */
  accion?: React.ReactNode;
  /** Si se da, se recuerda en sessionStorage que se ocultó. */
  claveSesion?: string;
  tono?: "aviso" | "info" | "peligro";
  className?: string;
}) {
  const [oculta, setOculta] = useState(false);

  useEffect(() => {
    if (!claveSesion) return;
    try {
      if (sessionStorage.getItem(`alerta-oculta:${claveSesion}`) === "1") setOculta(true);
    } catch {
      /* sin almacenamiento: se vuelve a mostrar */
    }
  }, [claveSesion]);

  if (oculta) return null;

  function ocultar() {
    setOculta(true);
    if (!claveSesion) return;
    try {
      sessionStorage.setItem(`alerta-oculta:${claveSesion}`, "1");
    } catch {
      /* nada */
    }
  }

  return (
    <section
      role="status"
      className={cn(
        "flex animate-estado-entrar flex-col gap-esp3 rounded-lg p-esp4 sm:flex-row sm:items-center sm:gap-esp4",
        tono === "aviso" && "bg-fondo-aviso-sutil",
        tono === "info" && "bg-fondo-info-sutil",
        tono === "peligro" && "bg-fondo-peligro-sutil",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-start gap-esp3 sm:items-center sm:gap-esp4">
        <Icono nombre="alerta" size={20} className="mt-0.5 text-icono-default sm:mt-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-esp1">
          <p className="text-destacado text-texto-primario">{titulo}</p>
          {descripcion && <div className="text-meta font-medium text-texto-secundario">{descripcion}</div>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-esp3 self-end sm:self-auto">
        <Boton variante="secundario" onClick={ocultar}>
          Ocultar
        </Boton>
        {accion}
      </div>
    </section>
  );
}
