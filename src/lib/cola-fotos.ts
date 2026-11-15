// Cola de fotos pendientes de enviar, guardada en el propio móvil (IndexedDB).
//
// Cuando el instalador hace una foto sin cobertura, en vez de perderla se guarda aquí (ya
// comprimida y con sus metadatos) y se envía sola en cuanto vuelve la conexión. Todo está envuelto
// en try/catch: en navegación privada o con el almacenamiento bloqueado IndexedDB puede fallar y
// entonces la foto simplemente no se encola (se avisa del error como antes).

const BD = "creativa-fotos";
const ALMACEN = "pendientes";
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

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    if (typeof indexedDB === "undefined") return rechazar(new Error("IndexedDB no disponible"));
    const peticion = indexedDB.open(BD, 1);
    peticion.onupgradeneeded = () => {
      peticion.result.createObjectStore(ALMACEN, { keyPath: "id", autoIncrement: true });
    };
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error ?? new Error("No se pudo abrir IndexedDB"));
  });
}

async function transaccion<T>(modo: IDBTransactionMode, fn: (a: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const bd = await abrir();
  try {
    return await new Promise<T>((resolver, rechazar) => {
      const tx = bd.transaction(ALMACEN, modo);
      const peticion = fn(tx.objectStore(ALMACEN));
      peticion.onsuccess = () => resolver(peticion.result);
      peticion.onerror = () => rechazar(peticion.error ?? new Error("Error de IndexedDB"));
    });
  } finally {
    bd.close();
  }
}

function avisarCambio() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_COLA));
}

/** Guarda una foto para enviarla más tarde. Devuelve false si no se pudo guardar. */
export async function encolarFoto(foto: Omit<FotoPendiente, "id" | "creada" | "rechazos">): Promise<boolean> {
  try {
    await transaccion("readwrite", (a) => a.add({ ...foto, creada: Date.now(), rechazos: 0 }));
    avisarCambio();
    return true;
  } catch {
    return false;
  }
}

export async function listarPendientes(): Promise<FotoPendiente[]> {
  try {
    const todas = await transaccion<FotoPendiente[]>("readonly", (a) => a.getAll());
    return todas.sort((x, y) => x.creada - y.creada);
  } catch {
    return [];
  }
}

export async function contarPendientes(): Promise<number> {
  try {
    return await transaccion<number>("readonly", (a) => a.count());
  } catch {
    return 0;
  }
}

export async function borrarPendiente(id: number): Promise<void> {
  try {
    await transaccion("readwrite", (a) => a.delete(id));
  } catch {
    /* sin almacenamiento: nada que borrar */
  }
  avisarCambio();
}

export async function marcarRechazo(foto: FotoPendiente): Promise<void> {
  try {
    await transaccion("readwrite", (a) => a.put({ ...foto, rechazos: foto.rechazos + 1 }));
  } catch {
    /* ignorar */
  }
}

/** ¿El fallo es de conexión (reintentable) y no un rechazo del servidor? */
export function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (e instanceof TypeError) return true;
  const mensaje = e instanceof Error ? e.message : "";
  return /failed to fetch|network|load failed|fetch failed|conexi[oó]n/i.test(mensaje);
}
