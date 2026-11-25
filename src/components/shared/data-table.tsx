import { cn } from "@/lib/cn";

/**
 * Tabla de datos compartida (sistema «Documentos»): contenedor con borde y radio 16, cabecera en
 * mayúsculas sobre fondo sutil, filas separadas por líneas y resaltado al pasar el ratón.
 * Desplazamiento horizontal propio en pantallas estrechas (`anchoMinimo`).
 * Sin estado: sirve en Server y Client Components. Para su loading.tsx: EsqueletoTabla (ui/esqueleto).
 */
export type ColumnaTabla<T> = {
  /** Clave estable de la columna. */
  id: string;
  cabecera: React.ReactNode;
  celda: (fila: T) => React.ReactNode;
  alinear?: "izquierda" | "derecha";
  /** Clases extra de las celdas de esta columna (p. ej. "tabular-nums whitespace-nowrap"). */
  clase?: string;
};

const RELLENO_BORDE = "px-esp4";
const RELLENO_MEDIO = "px-esp3";

function relleno(i: number, total: number) {
  return i === 0 || i === total - 1 ? RELLENO_BORDE : RELLENO_MEDIO;
}

export function DataTable<T>({
  columnas,
  filas,
  clave,
  vacio,
  anchoMinimo = 640,
  etiqueta,
  pie,
  className,
}: {
  columnas: ColumnaTabla<T>[];
  filas: T[];
  clave: (fila: T) => string | number;
  /** Lo que se muestra si no hay filas. */
  vacio?: React.ReactNode;
  /** Ancho mínimo de la tabla en px (por debajo, desplazamiento horizontal). */
  anchoMinimo?: number;
  /** Nombre accesible de la tabla. */
  etiqueta?: string;
  /** Filas de totales (se pintan dentro de <tfoot>). */
  pie?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-borde-default bg-fondo-superficie", className)}>
      <table className="w-full text-left text-sm" style={{ minWidth: anchoMinimo }} aria-label={etiqueta}>
        <thead>
          <tr className="border-b border-borde-default bg-fondo-sutil/70 text-etiqueta uppercase text-texto-secundario">
            {columnas.map((c, i) => (
              <th
                key={c.id}
                scope="col"
                className={cn(relleno(i, columnas.length), "py-esp3 font-semibold", c.alinear === "derecha" && "text-right")}
              >
                {c.cabecera}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borde-default">
          {filas.length === 0 && vacio != null ? (
            <tr>
              <td colSpan={columnas.length} className="px-esp4 py-esp5 text-texto-terciario">
                {vacio}
              </td>
            </tr>
          ) : (
            filas.map((f) => (
              <tr key={clave(f)} className="transition-colors duration-rapida ease-suave hover:bg-fondo-sutil/60">
                {columnas.map((c, i) => (
                  <td
                    key={c.id}
                    className={cn(relleno(i, columnas.length), "py-esp2", c.alinear === "derecha" && "text-right", c.clase)}
                  >
                    {c.celda(f)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {pie && <tfoot>{pie}</tfoot>}
      </table>
    </div>
  );
}
