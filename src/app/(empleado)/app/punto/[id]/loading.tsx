import { Esqueleto } from "@/components/ui/esqueleto";

export default function CargandoPunto() {
  return (
    <div
      className="flex flex-col gap-esp5 px-esp4 pt-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando ficha del punto"
    >
      <span className="sr-only">Cargando ficha del punto…</span>
      <div className="flex items-center gap-esp3">
        <Esqueleto className="h-10 w-10 shrink-0 rounded-md" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Esqueleto className="h-5 w-48 max-w-[80%]" />
          <Esqueleto className="h-3.5 w-36 bg-fondo-sutil" />
        </div>
        <Esqueleto className="h-6 w-20 rounded-completo" />
      </div>
      <Esqueleto className="h-[220px] w-full rounded-xl border border-borde-default bg-fondo-superficie" />
      <Esqueleto className="h-24 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
      <div className="grid grid-cols-3 gap-esp2">
        <Esqueleto className="aspect-square w-full rounded-md" />
        <Esqueleto className="aspect-square w-full rounded-md bg-fondo-sutil" />
        <Esqueleto className="aspect-square w-full rounded-md bg-fondo-sutil" />
      </div>
      <Esqueleto className="h-12 w-full rounded-md" />
    </div>
  );
}
