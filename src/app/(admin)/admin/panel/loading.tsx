import { Esqueleto, EsqueletoCabecera } from "@/components/ui/esqueleto";

const TARJETA = "flex flex-col rounded-xl border border-borde-default bg-fondo-superficie";

export default function CargandoPanel() {
  return (
    <div
      className="flex flex-col gap-esp5"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Cargando resumen"
    >
      <span className="sr-only">Cargando el resumen…</span>
      <EsqueletoCabecera />
      <div className="grid grid-cols-1 gap-esp4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className={`${TARJETA} gap-esp2 p-esp5`}>
            <Esqueleto className="h-4 w-28 bg-fondo-sutil" />
            <Esqueleto className="h-9 w-36" />
            <Esqueleto className="h-3.5 w-44 bg-fondo-sutil" />
            <Esqueleto className="mt-esp2 h-[30px] w-full bg-fondo-sutil" />
            <Esqueleto className="mt-esp6 h-[84px] w-full bg-fondo-sutil" />
            <Esqueleto className="mt-esp4 h-3.5 w-24 bg-fondo-sutil" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-esp5 xl:flex-row">
        <div className={`${TARJETA} h-[336px] flex-1 gap-esp5 p-esp6`}>
          <Esqueleto className="h-6 w-56" />
          <div className="grid grid-cols-3 gap-esp6">
            <Esqueleto className="h-20 bg-fondo-sutil" />
            <Esqueleto className="h-20 bg-fondo-sutil" />
            <Esqueleto className="h-20 bg-fondo-sutil" />
          </div>
          <Esqueleto className="h-16 w-full bg-fondo-sutil" />
        </div>
        <div className={`${TARJETA} h-[336px] w-full gap-esp4 p-esp6 xl:w-[448px]`}>
          <Esqueleto className="h-6 w-44" />
          <Esqueleto className="h-14 w-full bg-fondo-sutil" />
          <Esqueleto className="h-14 w-full bg-fondo-sutil" />
          <Esqueleto className="h-14 w-full bg-fondo-sutil" />
        </div>
      </div>
      <div className="flex flex-col gap-esp5 xl:flex-row">
        <div className={`${TARJETA} h-[484px] flex-1 gap-esp3 p-esp4`}>
          <Esqueleto className="h-6 w-52" />
          <Esqueleto className="h-8 w-full max-w-[396px] bg-fondo-sutil" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-esp4 p-esp4">
              <Esqueleto className="h-10 w-10 shrink-0 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Esqueleto className="h-5 w-56 max-w-[70%]" />
                <Esqueleto className="h-3.5 w-36 bg-fondo-sutil" />
              </div>
              <Esqueleto className="h-5 w-24" />
              <Esqueleto className="h-11 w-11 rounded-completo" />
            </div>
          ))}
        </div>
        <div className={`${TARJETA} h-[484px] w-full gap-esp4 p-esp6 xl:w-[448px]`}>
          <Esqueleto className="h-6 w-32" />
          <Esqueleto className="h-8 w-full bg-fondo-sutil" />
          <Esqueleto className="mx-auto mt-esp6 h-16 w-16 rounded-xl bg-fondo-sutil" />
        </div>
      </div>
    </div>
  );
}
