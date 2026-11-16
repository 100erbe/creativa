import { Esqueleto } from "@/components/ui/esqueleto";

export default function CargandoAgenda() {
  return (
    <div
      className="flex flex-col gap-esp5 px-esp4 pt-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando agenda"
    >
      <span className="sr-only">Cargando agenda de campo…</span>
      <div className="space-y-1.5">
        <Esqueleto className="h-4 w-36 bg-fondo-sutil" />
        <Esqueleto className="h-7 w-48" />
      </div>
      <div className="grid grid-cols-3 gap-esp2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-lg border border-borde-default bg-fondo-superficie px-esp3 py-esp3"
          >
            <Esqueleto className="h-3 w-14 bg-fondo-sutil" />
            <Esqueleto className="h-6 w-8" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-esp3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-esp3 rounded-lg border border-borde-default bg-fondo-superficie px-esp4 py-esp3"
          >
            <Esqueleto className="h-10 w-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Esqueleto className="h-4 w-44 max-w-[75%]" />
              <Esqueleto className="h-3 w-56 max-w-[90%] bg-fondo-sutil" />
            </div>
            <Esqueleto className="h-6 w-20 rounded-completo" />
          </div>
        ))}
      </div>
    </div>
  );
}
