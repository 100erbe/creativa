/**
 * Redondeo a céntimos igual que `round(x, 2)` de PostgreSQL (mitad lejos de cero) y sin los
 * errores de coma flotante (1.005 → 1.01, -1.005 → -1.01). Único para toda la app: totales de
 * documentos, IVA, cobros, libro AEAT y resúmenes fiscales.
 */
export function redondearCentimos(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const signo = n < 0 ? -1 : 1;
  const r = (signo * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
  return Object.is(r, -0) ? 0 : r;
}

/** Fecha de hoy en España (AAAA-MM-DD), aunque el servidor o el móvil estén en otra zona horaria. */
export function hoyEnEspana(ahora = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(ahora);
}
