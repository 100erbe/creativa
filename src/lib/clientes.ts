// Etiquetas en castellano para los enums de clientes.

// Tuplas literales: sirven a la vez para zod y para que los tipos coincidan
// con los enums de la base de datos.
export const VALORES_TIPO_CLIENTE = [
  "agencia_revendedor",
  "promotor_productora",
  "marca_empresa",
  "institucion_asociacion",
  "particular",
] as const;

export const VALORES_REGIMEN_IVA = ["general", "reducido", "intracomunitario", "exento"] as const;

export const TIPOS_CLIENTE: { valor: (typeof VALORES_TIPO_CLIENTE)[number]; etiqueta: string }[] = [
  { valor: "agencia_revendedor", etiqueta: "Agencia / revendedor" },
  { valor: "promotor_productora", etiqueta: "Promotor / productora" },
  { valor: "marca_empresa", etiqueta: "Marca / empresa" },
  { valor: "institucion_asociacion", etiqueta: "Institución / asociación" },
  { valor: "particular", etiqueta: "Particular" },
];

export const ETIQUETA_TIPO_CLIENTE: Record<string, string> = Object.fromEntries(
  TIPOS_CLIENTE.map((t) => [t.valor, t.etiqueta]),
);

export const TIPOS_DOCUMENTO_ID = ["NIF", "CIF", "NIE", "VAT_UE", "OTRO"] as const;

export const REGIMENES_IVA: { valor: (typeof VALORES_REGIMEN_IVA)[number]; etiqueta: string }[] = [
  { valor: "general", etiqueta: "General (21 %)" },
  { valor: "reducido", etiqueta: "Reducido" },
  { valor: "intracomunitario", etiqueta: "Intracomunitario" },
  { valor: "exento", etiqueta: "Exento" },
];

export const ETIQUETA_REGIMEN: Record<string, string> = Object.fromEntries(
  REGIMENES_IVA.map((r) => [r.valor, r.etiqueta]),
);

/** Devuelve 1-2 iniciales en mayúsculas para el avatar de empresa/cliente. */
export function inicialesCliente(nombre: string | null | undefined): string {
  const limpio = (nombre ?? "").trim();
  if (!limpio) return "CL";
  const palabras = limpio.split(/\s+/).filter(Boolean);
  if (palabras.length >= 2) {
    return `${palabras[0]![0] ?? ""}${palabras[1]![0] ?? ""}`.toUpperCase();
  }
  return limpio.slice(0, 2).toUpperCase();
}
