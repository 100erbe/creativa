// Cola de fotos de punto pendientes de enviar, guardada en el propio móvil (IndexedDB).
// Cuando el instalador hace una foto sin cobertura, en vez de perderla se guarda aquí (ya
// comprimida y con sus metadatos) y se envía sola en cuanto vuelve la conexión.

import { crearCola, esErrorDeRed } from "@/lib/cola-indexeddb";

export const EVENTO_COLA = "creativa:cola-fotos";

export type FotoPendiente = {
  id?: number;
  creada: number;
  puntoId: number;
  nombre: string;
  archivo: Blob;
  /** Campos del formulario de `subirFotoPunto` (todos texto). */
  campos: Record<string, string>;
  /** Cuántas veces el servidor la ha rechazado (con conexión): al tercer rechazo se descarta. */
  rechazos: number;
};

const cola = crearCola<FotoPendiente>("creativa-fotos", EVENTO_COLA);

export const encolarFoto = cola.encolar;
export const listarPendientes = cola.listar;
export const contarPendientes = cola.contar;
export const borrarPendiente = cola.borrar;
export const marcarRechazo = (foto: FotoPendiente) => cola.actualizar({ ...foto, rechazos: foto.rechazos + 1 });
export { esErrorDeRed };
