import { Esqueleto, EsqueletoCabecera, EsqueletoKpis, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoCobros() {
  return (
    <div
      className="flex flex-col gap-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando cobros"
    >
      <span className="sr-only">Cargando cobros y vencimientos…</span>
      <EsqueletoCabecera />
      <EsqueletoKpis />
      <Esqueleto className="h-40 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
      <EsqueletoTabla filas={6} />
    </div>
  );
}
