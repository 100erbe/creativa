import { cn } from "@/lib/cn";

// Logo "Creativa Producciones" (public/brand/logo-creativa.svg, proporción 641 × 171).
// Se pinta con <img> porque es un SVG estático: no necesita optimización de imagen.
const PROPORCION = 641 / 171;

export function Logo({ alto = 40, className }: { alto?: number; className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/logo-creativa-ui.svg"
      alt="Creativa Producciones"
      width={Math.round(alto * PROPORCION)}
      height={alto}
      className={cn("w-auto shrink-0", className)}
      style={{ height: alto }}
    />
  );
}
