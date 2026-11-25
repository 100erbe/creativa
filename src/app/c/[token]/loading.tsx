import { Esqueleto } from "@/components/ui/esqueleto";

export default function CargandoCampanaPublica() {
  return (
    <main
      className="mx-auto flex min-h-dvh max-w-2xl flex-col gap-esp5 bg-fondo-lienzo px-esp4 py-esp6 sm:py-esp8"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando la campaña"
    >
      <span className="sr-only">Cargando la campaña…</span>
      <Esqueleto className="h-10 w-32" />
      <Esqueleto className="h-40 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
      <Esqueleto className="h-48 w-full rounded-xl" />
      <Esqueleto className="h-32 w-full rounded-xl border border-borde-default bg-fondo-superficie" />
    </main>
  );
}
