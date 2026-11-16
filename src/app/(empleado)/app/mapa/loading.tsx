import { Esqueleto } from "@/components/ui/esqueleto";

export default function CargandoMapa() {
  return (
    <div
      className="flex flex-col gap-esp4 px-esp4 pt-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando mapa"
    >
      <span className="sr-only">Cargando mapa de puntos…</span>
      <Esqueleto className="h-7 w-44" />
      <div className="flex gap-esp2">
        <Esqueleto className="h-9 w-20 rounded-completo" />
        <Esqueleto className="h-9 w-24 rounded-completo bg-fondo-sutil" />
        <Esqueleto className="h-9 w-28 rounded-completo bg-fondo-sutil" />
      </div>
      <Esqueleto className="h-[360px] w-full rounded-lg border border-borde-default bg-fondo-superficie" />
      <div className="flex flex-col gap-esp2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Esqueleto key={i} className="h-16 w-full rounded-lg border border-borde-default bg-fondo-superficie" />
        ))}
      </div>
    </div>
  );
}
