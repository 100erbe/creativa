/**
 * Tipos de datos que comparten la lógica (src/lib) y los componentes. Viven aquí para que lib no
 * dependa de components (paso previo para reutilizar lib en la app nativa). Los componentes los
 * reexportan con el mismo nombre, así que los imports existentes siguen valiendo.
 */

/** Tono de una insignia de estado (components/ui/insignia). */
export type TonoInsignia = "neutro" | "marca" | "exito" | "aviso" | "peligro" | "critico" | "info";

/** Aviso de la bandeja (components/avisos/bandeja). */
export type NotificacionBandeja = {
  id: number;
  titulo: string;
  cuerpo: string;
  url: string | null;
  creada: string; // ya formateada ("15 nov, 20:05")
  leida: boolean;
};

/** Sugerencia de un buscador con autocompletado (components/ui/autocompletar). */
export type Sugerencia = {
  /** Clave única dentro de la lista. */
  id: string;
  /** Texto principal (nombre, número de documento…). */
  titulo: string;
  /** Línea secundaria opcional (fecha, importe, NIF…). */
  detalle?: string;
  /** Etiqueta corta a la derecha (tipo o estado). */
  insignia?: string;
  /** Ruta que se abre al elegirla, salvo que se pase `onElegir`. */
  href?: string;
};
