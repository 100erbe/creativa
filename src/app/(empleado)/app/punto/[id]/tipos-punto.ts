import type { GeometriaZona, TipoUbicacion } from "@/lib/mapa/zonas";

/** Punto tal como lo pinta la ficha del miembro (FichaPunto + PanelPunto). */
export type PuntoFicha = {
  id: number;
  nombre: string;
  tipo_soporte: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  tipo_ubicacion?: TipoUbicacion;
  radio_metros?: number | null;
  geometria?: GeometriaZona | null;
  estado: string;
  notas: string | null;
  incidencia: string | null;
  piezas: number | null;
  fecha_colocacion_prevista: string | null;
  fecha_retirada_prevista: string | null;
  campanas: { nombre: string; descripcion: string | null } | { nombre: string; descripcion: string | null }[] | null;
};

export type FotoFicha = {
  id: number;
  tipo: string;
  url: string | null;
  tomada_en: string;
  usuario_id: string | null;
  latitud: number | null;
  longitud: number | null;
  origen_foto: string;
  origen_ubicacion: string | null;
};

export type OtroPuntoContexto = {
  id: number;
  nombre: string;
  direccion: string | null;
  latitud: number;
  longitud: number;
  tipo_ubicacion: TipoUbicacion;
  radio_metros: number | null;
  geometria: GeometriaZona | null;
};

export function campanaDe(punto: PuntoFicha) {
  return Array.isArray(punto.campanas) ? punto.campanas[0] : punto.campanas;
}
