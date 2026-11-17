// Constantes compartidas por la reclamación de impagadas (servidor y navegador).

export const BUCKET_RECLAMACIONES = "reclamaciones";

/** El lote es un UUID que genera el navegador para agrupar los PDF de una reclamación. */
export const LOTE_VALIDO = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function rutaAdjunto(clienteId: number, lote: string, archivo: "estado" | number) {
  return `${clienteId}/${lote}/${archivo}.pdf`;
}

const EMAIL = /^[^\s@<>(),;:"[\]\\]+@[^\s@<>(),;:"[\]\\]+\.[^\s@<>(),;:"[\]\\]+$/;

export function emailValido(email: string) {
  return EMAIL.test(email.trim());
}

/** Separa «a@x.es, b@y.es; c@z.es» en direcciones limpias, sin repetir. */
export function separarEmails(texto: string): string[] {
  return [...new Set(texto.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
}
