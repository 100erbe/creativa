import { fechaLarga, fechaMedia } from "@/lib/formato";

/**
 * Subtítulo de cabecera con fecha responsive:
 * - Móvil (< sm): formato compacto ("Resumen de hoy · 18 nov 2026") para evitar que el año quede huérfano en otra línea.
 * - Tablet/escritorio (sm+): fecha larga completa ("Resumen de hoy · miércoles, 18 de noviembre de 2026").
 */
export function SubtituloHoy({ prefijo, fecha }: { prefijo: string; fecha: string | Date }) {
  return (
    <>
      {prefijo} ·{" "}
      <span className="whitespace-nowrap sm:hidden">{fechaMedia(fecha)}</span>
      <span className="hidden sm:inline">{fechaLarga(fecha)}</span>
    </>
  );
}
