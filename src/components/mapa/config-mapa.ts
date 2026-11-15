// Configuración común de todos los mapas de la app.

/**
 * Mapa base: OpenFreeMap, estilo "positron" (vectorial, gratuito y sin clave). Muestra calles y nombres, pero
 * no los iconos de comercios, iglesias, museos… que con el mapa estándar de OpenStreetMap tapaban los puntos.
 * Se dibuja con MapLibre (ver capa-base.tsx). Para cambiar de proveedor basta con cambiar esta URL de estilo
 * (cualquier estilo MapLibre/Mapbox GL: MapTiler, Stadia…).
 *
 * Alternativa si el móvil no admite WebGL o el estilo no carga: imágenes de OpenStreetMap (con iconos).
 * Nota: CARTO "Positron" ya no es gratuito sin clave, por eso no se usa.
 */
export const MAPA_ESTILO = "https://tiles.openfreemap.org/styles/positron";
export const MAPA_ATRIBUCION_VECTORIAL =
  '<a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> &copy; <a href="https://openmaptiles.org/" target="_blank" rel="noreferrer">OpenMapTiles</a> datos de <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';

export const MAPA_TESELAS = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
export const MAPA_SUBDOMINIOS = "abc";
export const MAPA_ATRIBUCION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">colaboradores de OpenStreetMap</a>';

/**
 * Alturas: el mapa es lo más importante de varias pantallas, así que crece con la pantalla en vez de tener
 * una altura fija (mínimo cómodo en móvil, máximo razonable en escritorio).
 */
export const ALTURA_MAPA_GRANDE = "clamp(380px, 66vh, 720px)";
export const ALTURA_MAPA_MEDIA = "clamp(320px, 52vh, 600px)";
export const ALTURA_MAPA_FICHA = "clamp(240px, 40vh, 400px)";
