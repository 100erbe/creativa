import { Monograma } from "@/components/ui/monograma";
import { cn } from "@/lib/cn";

const TAMANOS = {
  s: "h-9 w-9",
  m: "h-10 w-10",
  l: "h-16 w-16",
} as const;

/**
 * Avatar de una persona: su foto (radio 12, como el monograma de Figma) o, si no tiene, sus iniciales.
 * `url` debe ser ya una URL servible (firmada en el servidor con urlAvatar).
 */
export function Avatar({
  url,
  iniciales,
  tamano = "s",
  className,
}: {
  url?: string | null;
  iniciales: string;
  tamano?: keyof typeof TAMANOS;
  className?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className={cn("shrink-0 rounded-lg bg-fondo-hover object-cover", TAMANOS[tamano], className)}
      />
    );
  }
  return (
    <Monograma
      texto={iniciales}
      variante={tamano === "s" ? "avatar" : "cliente"}
      className={cn(TAMANOS[tamano], tamano === "l" && "text-xl", className)}
    />
  );
}
