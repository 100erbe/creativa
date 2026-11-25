import { EsqueletoCabecera, EsqueletoKpis, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoContabilidad() {
  return (
    <div
      className="flex flex-col gap-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando contabilidad"
    >
      <span className="sr-only">Cargando contabilidad…</span>
      <EsqueletoCabecera />
      <EsqueletoKpis />
      <EsqueletoTabla filas={8} />
    </div>
  );
}
