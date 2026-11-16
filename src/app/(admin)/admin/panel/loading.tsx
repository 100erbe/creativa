import { Esqueleto, EsqueletoCabecera, EsqueletoKpis } from "@/components/ui/esqueleto";

export default function CargandoPanel() {
  return (
    <div
      className="flex flex-col gap-esp6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando panel"
    >
      <span className="sr-only">Cargando panel principal…</span>
      <EsqueletoCabecera />
      <EsqueletoKpis cantidad={4} />
      <div className="rounded-lg border border-borde-default bg-fondo-superficie p-esp5">
        <div className="flex items-center justify-between">
          <Esqueleto className="h-5 w-64" />
          <Esqueleto className="h-4 w-24 bg-fondo-sutil" />
        </div>
        <Esqueleto className="mt-esp4 h-3 w-full rounded-completo" />
        <div className="mt-esp4 space-y-2">
          <Esqueleto className="h-14 w-full bg-fondo-sutil" />
          <Esqueleto className="h-14 w-full bg-fondo-sutil" />
        </div>
      </div>
      <div className="flex flex-col gap-esp6 xl:flex-row">
        <Esqueleto className="h-64 flex-1 rounded-lg border border-borde-default bg-fondo-superficie" />
        <Esqueleto className="h-64 w-full rounded-lg border border-borde-default bg-fondo-superficie xl:w-[420px]" />
      </div>
    </div>
  );
}
