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

  return (
    <div className={cn("flex flex-col gap-esp1", className)}>
      <label htmlFor={id} className="text-xs font-medium text-texto-secundario">
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
        className={cn(
          "h-10 rounded-md border bg-fondo-superficie px-esp3 text-sm text-texto-primario outline-none placeholder:text-texto-terciario",
          "focus:border-borde-foco focus:ring-2 focus:ring-borde-foco/20",
          error ? "border-borde-peligro" : "border-borde-campo",
        )}
      />
      {mensaje && (
        <p className={cn("text-xs", error ? "text-texto-peligro" : "text-texto-terciario")}>
          {mensaje}
        </p>
      )}
    </div>
  );
}
