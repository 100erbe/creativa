import { useId } from "react";
import { cn } from "@/lib/cn";

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
  className,
}: Props) {
  const id = useId();
  const mensaje = error ?? ayuda;
  const mensajeId = mensaje ? `${id}-msg` : undefined;

  return (
    <div className={cn("flex flex-col gap-esp1", className)}>
      <label htmlFor={id} className="text-etiqueta text-texto-secundario">
        {etiqueta}
      </label>
      <input
        id={id}
        type={tipo}
        value={valor}
        onChange={(e) => onCambio(e.target.value)}
        required={requerido}
        autoFocus={autoFocus}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={mensajeId}
        className={cn(
          "min-h-11 h-11 md:min-h-10 md:h-10 rounded-lg border bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none transition-[border-color,box-shadow] duration-rapida ease-suave placeholder:text-texto-terciario",
          "focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20",
          error ? "border-borde-peligro" : "border-borde-campo",
        )}
      />
      {mensaje && (
        <p id={mensajeId} className={cn("animate-estado-entrar text-xs", error ? "text-texto-peligro" : "text-texto-terciario")}>
          {mensaje}
        </p>
      )}
    </div>
  );
}
