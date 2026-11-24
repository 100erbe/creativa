// Cola de envíos pendientes guardada en el propio móvil (IndexedDB).
//
// Lo que no se puede enviar sin cobertura se guarda aquí y se envía solo cuando vuelve la conexión.
// Todo está envuelto en try/catch: en navegación privada o con el almacenamiento bloqueado IndexedDB
// puede fallar y entonces el elemento simplemente no se encola (se avisa del error como antes).

export type ElementoCola = { id?: number; creada: number; rechazos: number };

export function crearCola<T extends ElementoCola>(nombreBd: string, evento: string) {
  const ALMACEN = "pendientes";

  function abrir(): Promise<IDBDatabase> {
    return new Promise((resolver, rechazar) => {
      if (typeof indexedDB === "undefined") return rechazar(new Error("IndexedDB no disponible"));
      const peticion = indexedDB.open(nombreBd, 1);
      peticion.onupgradeneeded = () => {
        peticion.result.createObjectStore(ALMACEN, { keyPath: "id", autoIncrement: true });
      };
      peticion.onsuccess = () => resolver(peticion.result);
      peticion.onerror = () => rechazar(peticion.error ?? new Error("No se pudo abrir IndexedDB"));
    });
  }

  async function transaccion<R>(modo: IDBTransactionMode, fn: (a: IDBObjectStore) => IDBRequest<R>): Promise<R> {
    const bd = await abrir();
    try {
      return await new Promise<R>((resolver, rechazar) => {
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
    if (typeof window !== "undefined") window.dispatchEvent(new Event(evento));
  }

  return {
    /** Guarda un elemento para enviarlo más tarde. Devuelve false si no se pudo guardar. */
    async encolar(elemento: Omit<T, "id" | "creada" | "rechazos">): Promise<boolean> {
      try {
        await transaccion("readwrite", (a) => a.add({ ...elemento, creada: Date.now(), rechazos: 0 }));
        avisarCambio();
        return true;
      } catch {
        return false;
      }
    },

    async listar(): Promise<T[]> {
      try {
        const todos = await transaccion<T[]>("readonly", (a) => a.getAll());
        return todos.sort((x, y) => x.creada - y.creada);
      } catch {
        return [];
      }
    },

    async contar(): Promise<number> {
      try {
        return await transaccion<number>("readonly", (a) => a.count());
      } catch {
        return 0;
      }
    },

    async borrar(id: number): Promise<void> {
      try {
        await transaccion("readwrite", (a) => a.delete(id));
      } catch {
        /* sin almacenamiento: nada que borrar */
      }
      avisarCambio();
    },

    /** Sustituye el elemento guardado (p. ej. tras un rechazo o un paso ya hecho). */
    async actualizar(elemento: T): Promise<void> {
      try {
        await transaccion("readwrite", (a) => a.put(elemento));
      } catch {
        /* ignorar */
      }
    },
  };
}

/** ¿El fallo es de conexión (reintentable) y no un rechazo del servidor? */
export function esErrorDeRed(e: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (e instanceof TypeError) return true;
  const mensaje = e instanceof Error ? e.message : "";
  return /failed to fetch|network|load failed|fetch failed|conexi[oó]n/i.test(mensaje);
}
