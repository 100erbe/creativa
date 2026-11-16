import { EsqueletoCabecera, EsqueletoTabla } from "@/components/ui/esqueleto";

export default function CargandoClientes() {
  return (
    <div
      className="flex flex-col gap-esp6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando clientes"
    >
      <span className="sr-only">Cargando lista de clientes…</span>
      <EsqueletoCabecera />
      <EsqueletoTabla filas={8} />
    </div>
  );
}
