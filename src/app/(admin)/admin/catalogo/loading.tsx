import { EsqueletoCabecera, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoCatalogo() {
  return (
    <div
      className="flex flex-col gap-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando catálogo"
    >
      <span className="sr-only">Cargando catálogo…</span>
      <EsqueletoCabecera />
      <EsqueletoTabla filas={10} />
    </div>
  );
}
