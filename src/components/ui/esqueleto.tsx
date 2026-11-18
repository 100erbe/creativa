import { cn } from "@/lib/cn";

export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse duration-pulso rounded-md bg-fondo-hover", className)}
    />
  );
}

export function EsqueletoCabecera({ conAccion = true }: { conAccion?: boolean }) {
  return (
    <div className="flex items-center gap-esp3">
      <div className="min-w-0 flex-1 space-y-2">
        <Esqueleto className="h-7 w-48" />
        <Esqueleto className="h-4 w-72 max-w-full bg-fondo-sutil" />
      </div>
      {conAccion && <Esqueleto className="h-11 w-11 shrink-0 md:h-9 md:w-36" />}
    </div>
  );
}

export function EsqueletoKpis({ cantidad = 4 }: { cantidad?: number }) {
  return (
    <div className="grid grid-cols-2 gap-esp3 md:gap-esp4 xl:grid-cols-4">
      {Array.from({ length: cantidad }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-esp2 rounded-xl border border-borde-default bg-fondo-superficie p-esp5"
        >
          <Esqueleto className="h-3.5 w-24 bg-fondo-sutil" />
          <Esqueleto className="h-8 w-32" />
          <Esqueleto className="h-3 w-20 bg-fondo-sutil" />
        </div>
      ))}
    </div>
  );
}

export function EsqueletoTabla({ filas = 6 }: { filas?: number }) {
  return (
    <div className="flex flex-col gap-esp4">
      <div className="flex flex-wrap items-center gap-esp2 rounded-xl border border-borde-default bg-fondo-superficie p-esp3 md:p-esp4">
        <Esqueleto className="h-9 w-20 rounded-completo" />
        <Esqueleto className="h-9 w-28 rounded-completo bg-fondo-sutil" />
        <Esqueleto className="h-9 w-24 rounded-completo bg-fondo-sutil" />
        <Esqueleto className="ml-auto h-9 w-full sm:w-56" />
      </div>
      <div className="divide-y divide-borde-default rounded-xl border border-borde-default bg-fondo-superficie px-esp4 md:px-esp6">
        {Array.from({ length: filas }).map((_, i) => (
          <div key={i} className="flex items-center gap-esp3 py-esp3 md:gap-esp4">
            <Esqueleto className="h-10 w-10 shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Esqueleto className="h-4 w-48 max-w-[70%]" />
              <Esqueleto className="h-3 w-36 max-w-[50%] bg-fondo-sutil" />
            </div>
            <Esqueleto className="hidden h-4 w-24 bg-fondo-sutil lg:block" />
            <Esqueleto className="h-5 w-20 shrink-0" />
            <Esqueleto className="hidden h-6 w-20 rounded-completo sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EsqueletoPipeline({ columnas = 4 }: { columnas?: number }) {
  return (
    <div className="grid grid-cols-1 gap-esp4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: columnas }).map((_, col) => (
        <div
          key={col}
          className="flex flex-col gap-esp3 rounded-xl border border-borde-default bg-fondo-sutil p-esp3"
        >
          <div className="flex items-center justify-between px-esp1">
            <Esqueleto className="h-4 w-28" />
            <Esqueleto className="h-5 w-8 rounded-completo" />
          </div>
          {Array.from({ length: 3 }).map((__, card) => (
            <div
              key={card}
              className="flex flex-col gap-esp2 rounded-xl border border-borde-default bg-fondo-superficie p-esp3"
            >
              <Esqueleto className="h-4 w-3/4" />
              <Esqueleto className="h-3 w-1/2 bg-fondo-sutil" />
              <div className="mt-1 flex items-center justify-between">
                <Esqueleto className="h-3 w-16 bg-fondo-sutil" />
                <Esqueleto className="h-5 w-16 rounded-completo" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
