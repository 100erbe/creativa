import { EsqueletoCabecera, EsqueletoPipeline } from "@/components/ui/esqueleto";

export default function CargandoCampanas() {
  return (
    <div
      className="flex flex-col gap-esp6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando campañas"
    >
      <span className="sr-only">Cargando campañas…</span>
      <EsqueletoCabecera />
      <EsqueletoPipeline columnas={4} />
    </div>
  );
}
