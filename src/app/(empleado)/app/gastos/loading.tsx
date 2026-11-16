import { Esqueleto } from "@/components/ui/esqueleto";

export default function CargandoMisGastos() {
  return (
    <div
      className="flex flex-col gap-esp4 px-esp4 pt-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando mis gastos"
    >
      <span className="sr-only">Cargando mis gastos…</span>
      <div className="flex items-center gap-esp3">
        <Esqueleto className="h-7 w-32 flex-1" />
        <Esqueleto className="h-11 w-32 rounded-md" />
      </div>
      <div className="grid grid-cols-3 gap-esp2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-1.5 rounded-lg border border-borde-default bg-fondo-superficie px-esp3 py-esp3"
          >
            <Esqueleto className="h-3 w-16 bg-fondo-sutil" />
            <Esqueleto className="h-5 w-20" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-esp3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Esqueleto key={i} className="h-20 w-full rounded-lg border border-borde-default bg-fondo-superficie" />
        ))}
      </div>
    </div>
  );
}
