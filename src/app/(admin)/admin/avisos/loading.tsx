import { EsqueletoCabecera, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoAvisos() {
  return (
    <div
      className="flex flex-col gap-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando avisos"
    >
      <span className="sr-only">Cargando avisos…</span>
      <EsqueletoCabecera />
      <EsqueletoTabla filas={6} />
    </div>
  );
}
