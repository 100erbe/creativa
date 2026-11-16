import { EsqueletoCabecera, EsqueletoKpis, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoAdmin() {
  return (
    <div
      className="flex flex-col gap-esp6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando contenido"
    >
      <span className="sr-only">Cargando contenido…</span>
      <EsqueletoCabecera />
      <EsqueletoKpis cantidad={4} />
      <EsqueletoTabla filas={5} />
    </div>
  );
}
