"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/cn";
import { Icono } from "@/components/ui/iconos";

// Corresponde al componente "Campo" de Figma (Estado: Normal/Foco/Error).
// El estado de foco lo gestiona el propio navegador con :focus; el estado
// de error se activa pasando la prop `error`.
type Props = {
  etiqueta: string;
  valor: string;
  onCambio: (valor: string) => void;
  tipo?: React.HTMLInputTypeAttribute;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  /** autocomplete del navegador ("given-name", "tel"…). */
  autoCompletar?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  className?: string;
};

export function Campo({
  etiqueta,
  valor,
  onCambio,
  tipo = "text",
  ayuda,
  error,
  requerido,
  autoFocus,
  placeholder,
  autoCompletar,
  inputMode,
  maxLength,
  className,
}: Props) {
  const id = useId();
  const mensaje = error ?? ayuda;
  const mensajeId = mensaje ? `${id}-msg` : undefined;
  // Los campos de contraseña llevan un botón con ojo para mostrar/ocultar lo escrito.
  const esContrasena = tipo === "password";
  const [visible, setVisible] = useState(false);

  return (
    <div className={cn("flex flex-col gap-esp1", className)}>
      <label htmlFor={id} className="text-etiqueta text-texto-secundario">
        {etiqueta}
      </label>
      <div className="relative">
        <input
          id={id}
          type={esContrasena && visible ? "text" : tipo}
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          required={requerido}
          autoFocus={autoFocus}
          placeholder={placeholder}
          autoComplete={autoCompletar}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={!!error}
          aria-describedby={mensajeId}
          className={cn(
            "w-full min-h-11 h-11 md:min-h-10 md:h-10 rounded-lg border bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none transition-[border-color,box-shadow] duration-rapida ease-suave placeholder:text-texto-terciario",
            "focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20",
            error ? "border-borde-peligro" : "border-borde-campo",
            esContrasena && "pr-11",
          )}
        />
        {esContrasena && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={visible}
            title={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-texto-terciario transition-colors duration-rapida ease-suave hover:text-texto-primario focus-visible:text-texto-primario focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-borde-foco/20"
          >
            <Icono nombre={visible ? "ojoTachado" : "ojo"} size={18} />
          </button>
        )}
      </div>
      {mensaje && (
        <p
          id={mensajeId}
          className={cn(
            "animate-estado-entrar text-xs",
            error ? "text-texto-peligro" : "text-texto-terciario",
          )}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
