// Etiquetas en castellano para los valores internos (enums) de campañas, puntos y asignaciones.
// Los documentos y cobros tienen las suyas en lib/documentos.ts.

export const ETIQUETA_SOPORTE: Record<string, string> = {
  valla: "Valla",
  totem: "Tótem",
  lona: "Lona",
  cartel: "Cartel",
  mobiliario_urbano: "Mobiliario urbano",
  marquesina: "Marquesina",
  pantalla: "Pantalla",
  otro: "Soporte",
};

/** Estado de una campaña. */
export const ETIQUETA_ESTADO_CAMPANA: Record<string, string> = {
  planificada: "Planificada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

/** Estado de un punto de campaña. */
export const ETIQUETA_ESTADO_PUNTO: Record<string, string> = {
  pendiente: "Pendiente",
  instalado: "Instalado",
  verificado: "Verificado",
  incidencia: "Incidencia",
  retirado: "Retirado",
};

/** Estado de la asignación de un punto a una persona. */
export const ETIQUETA_ESTADO_ASIGNACION: Record<string, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
};

/** Cualquier estado de campaña o punto (para insignias que no saben de cuál se trata). */
export const ETIQUETA_ESTADO: Record<string, string> = {
  ...ETIQUETA_ESTADO_CAMPANA,
  ...ETIQUETA_ESTADO_PUNTO,
};

/** Convierte un valor interno (`en_curso`) en algo legible; si no lo conoce, lo humaniza. */
export function etiquetaEstado(estado: string | null | undefined, tabla: Record<string, string> = ETIQUETA_ESTADO) {
  if (!estado) return "";
  const conocida = tabla[estado];
  if (conocida) return conocida;
  const texto = estado.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
