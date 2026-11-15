export default function CargandoAdmin() {
  return (
    <div className="flex flex-col gap-esp4" role="status" aria-label="Cargando">
      <div className="h-8 w-56 animate-pulse rounded-md bg-fondo-hover" />
      <div className="h-4 w-80 max-w-full animate-pulse rounded-md bg-fondo-sutil" />
      <div className="mt-esp4 h-64 animate-pulse rounded-lg border border-borde-default bg-fondo-superficie" />
    </div>
  );
}
