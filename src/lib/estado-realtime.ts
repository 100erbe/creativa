/**
 * Estado de la conexión Realtime de Supabase en este navegador (lo marca SincronizadorVivo).
 * Mientras está conectada, los avisos llegan al momento y el sondeo de respaldo no hace falta.
 */
let conectado = false;

export function marcarRealtimeConectado(valor: boolean) {
  conectado = valor;
}

export function realtimeConectado() {
  return conectado;
}
