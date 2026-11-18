import { Esqueleto, EsqueletoKpis } from "@/components/ui/esqueleto";

export default function CargandoCliente() {
  return (
    <div
      className="flex flex-col gap-esp6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando ficha del cliente"
    >
      <span className="sr-only">Cargando ficha del cliente…</span>
      <div className="flex flex-col gap-esp3">
        <Esqueleto className="h-4 w-24 bg-fondo-sutil" />
        <div className="flex flex-wrap items-center gap-esp3">
          <Esqueleto className="h-12 w-12 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-2">
            <Esqueleto className="h-7 w-64 max-w-full" />
            <Esqueleto className="h-4 w-48 bg-fondo-sutil" />
          </div>
          <div className="flex gap-esp2">
            <Esqueleto className="h-11 w-24 md:h-9" />
            <Esqueleto className="h-11 w-32 md:h-9" />
          </div>
        </div>
      </div>

      <EsqueletoKpis cantidad={4} />

      <div className="flex flex-col gap-esp6 xl:flex-row">
        <div className="flex min-w-0 flex-1 flex-col gap-esp4">
          <Esqueleto className="h-72 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
          <Esqueleto className="h-44 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
        </div>
        <div className="flex w-full shrink-0 flex-col gap-esp4 xl:w-[360px]">
          <Esqueleto className="h-72 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
          <Esqueleto className="h-48 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
        </div>
      </div>
    </div>
  );
}
