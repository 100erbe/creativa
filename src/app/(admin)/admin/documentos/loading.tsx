import { Esqueleto, EsqueletoCabecera, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoDocumentos() {
  return (
    <div
      className="flex flex-col gap-esp6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando documentos"
    >
      <span className="sr-only">Cargando documentos y cobros…</span>
      <EsqueletoCabecera />
      <Esqueleto className="h-14 w-full rounded-lg border border-borde-default bg-fondo-superficie" />
      <EsqueletoTabla filas={8} />
    </div>
  );
}
