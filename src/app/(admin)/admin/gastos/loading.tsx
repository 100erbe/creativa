import { EsqueletoCabecera, EsqueletoKpis, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoGastos() {
  return (
    <div
      className="flex flex-col gap-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando gastos"
    >
      <span className="sr-only">Cargando gastos…</span>
      <EsqueletoCabecera />
      <EsqueletoKpis />
      <EsqueletoTabla filas={8} />
    </div>
  );
}
