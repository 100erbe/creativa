export default function CargandoEmpleado() {
  return (
    <div className="flex flex-col gap-esp4 px-esp4 pt-esp5" role="status" aria-label="Cargando">
      <div className="h-6 w-40 animate-pulse rounded-md bg-fondo-hover" />
      <div className="h-20 animate-pulse rounded-lg border border-borde-default bg-fondo-superficie" />
      <div className="h-20 animate-pulse rounded-lg border border-borde-default bg-fondo-superficie" />
    </div>
  );
}
