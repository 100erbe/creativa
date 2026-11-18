import { Esqueleto } from "@/components/ui/esqueleto";

export default function CargandoEmpleado() {
  return (
    <div
      className="flex flex-col gap-esp4 px-esp4 pt-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando"
    >
      <span className="sr-only">Cargando contenido…</span>
      <Esqueleto className="h-6 w-40" />
      <Esqueleto className="h-24 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
      <Esqueleto className="h-24 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
    </div>
  );
}
