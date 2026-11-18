import { cn } from "@/lib/cn";

// Monograma del sistema "Documentos": iniciales sobre fondo gris (radio 12).
// - cliente (40×40, 14/20 negrita, texto secundario): filas de documentos y clientes
// - avatar  (36×36, 12/18 seminegrita, texto primario): menú de cuenta
export function Monograma({
  texto,
  variante = "cliente",
  className,
}: {
  texto: string;
  variante?: "cliente" | "avatar";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-lg bg-fondo-hover uppercase",
        variante === "cliente"
          ? "h-10 w-10 text-monograma text-texto-secundario"
          : "h-9 w-9 text-etiqueta text-texto-primario",
        className,
      )}
    >
      {texto.slice(0, 2)}
    </span>
  );
}

/** Iniciales de una razón social: «Sea Life Centre Spain S.A.» → «SL». Ignora artículos y formas jurídicas. */
export function inicialesDe(nombre: string | null | undefined): string {
  if (!nombre) return "—";
  const vacias = new Set(["de", "del", "la", "las", "el", "los", "y", "s.a.", "s.l.", "sa", "sl", "slu", "s.l.u.", "excmo.", "excma."]);
  const palabras = nombre
    .replace(/[«»"()]/g, " ")
    .split(/\s+/)
    .filter((p) => p && !vacias.has(p.toLowerCase()));
  const [a, b] = palabras;
  if (!a) return nombre.slice(0, 2).toUpperCase();
  return ((a[0] ?? "") + (b?.[0] ?? a[1] ?? "")).toUpperCase();
}
