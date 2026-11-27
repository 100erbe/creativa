import { EsqueletoCabecera, EsqueletoKpis, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoRentabilidad() {
  return (
    <div
      className="flex flex-col gap-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando rentabilidad"
    >
      <span className="sr-only">Cargando rentabilidad…</span>
      <EsqueletoCabecera />
      <EsqueletoKpis />
      <EsqueletoTabla filas={8} />
    </div>
  );
}
