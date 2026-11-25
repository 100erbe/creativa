import { Esqueleto, EsqueletoCabecera, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoCampana() {
  return (
    <div
      className="flex flex-col gap-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando campaña"
    >
      <span className="sr-only">Cargando campaña…</span>
      <EsqueletoCabecera />
      <Esqueleto className="h-48 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
      <EsqueletoTabla filas={5} />
    </div>
  );
}
