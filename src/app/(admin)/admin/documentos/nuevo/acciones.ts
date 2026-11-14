"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import type { Database } from "@/lib/supabase/types";

type Alcance = Database["public"]["Enums"]["alcance_servicio"];
type TipoSoporte = Database["public"]["Enums"]["tipo_soporte"];
export type TipoNuevoDocumento = "presupuesto" | "albaran" | "factura";

const TIPOS_PERMITIDOS: TipoNuevoDocumento[] = ["presupuesto", "albaran", "factura"];

function refrescar(documentoId?: number) {
  revalidatePath("/admin/documentos/nuevo");
  revalidatePath("/admin/documentos");
  if (documentoId) revalidatePath(`/admin/documentos/${documentoId}`);
}

/** Condiciones del cliente que el documento hereda (IVA, forma de pago, cuenta). */
async function condicionesCliente(supabase: Awaited<ReturnType<typeof createClient>>, clienteId: number) {
  const { data: c, error } = await supabase
    .from("clientes")
    .select("regimen_iva, motivo_exencion, forma_pago_id, cuenta_cobro_id")
    .eq("id", clienteId)
    .single();
  if (error || !c) throw new Error("No se ha encontrado el cliente.");
  return {
    regimen_iva: c.regimen_iva,
    motivo_exencion: c.motivo_exencion,
    forma_pago_id: c.forma_pago_id,
    cuenta_cobro_id: c.cuenta_cobro_id,
  };
}

/** Paso 1 → 2: crea el borrador del tipo elegido con la serie por defecto. */
export async function crearBorrador(clienteId: number, tipo: TipoNuevoDocumento = "presupuesto") {
  await exigirAdmin();
  if (!TIPOS_PERMITIDOS.includes(tipo)) throw new Error("Tipo de documento no válido.");
  const supabase = await createClient();

  const { data: serie, error: errorSerie } = await supabase
    .from("series")
    .select("id")
    .eq("tipo", tipo)
    .eq("por_defecto", true)
    .single();
  if (errorSerie || !serie) {
    throw new Error(`No hay una serie por defecto configurada para ${tipo}.`);
  }

  const condiciones = await condicionesCliente(supabase, clienteId);
  const { data, error } = await supabase
    .from("documentos")
    .insert({ tipo, serie_id: serie.id, cliente_id: clienteId, ...condiciones })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  refrescar();
  return data.id as number;
}

/** "Cambiar" cliente de un borrador ya creado (mantiene las líneas). */
export async function cambiarCliente(documentoId: number, clienteId: number) {
  await exigirAdmin();
  const supabase = await createClient();
  const condiciones = await condicionesCliente(supabase, clienteId);
  const { error } = await supabase
    .from("documentos")
    .update({ cliente_id: clienteId, ...condiciones })
    .eq("id", documentoId)
    .eq("estado", "borrador");
  if (error) throw new Error(error.message);
  refrescar(documentoId);
}

type ArgsLinea = {
  productoId: number;
  formatoId: number | null;
  alcance: Alcance;
  piezas: number;
  anchoCm?: number | null;
  altoCm?: number | null;
};

/** Precio de tarifa (cliente > tipo de cliente > volumen > formato > producto). */
export async function previsualizarPrecio(args: ArgsLinea & { clienteId: number }) {
  await exigirAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("previsualizar_precio", {
    p_producto: args.productoId,
    p_formato: args.formatoId,
    p_cliente: args.clienteId,
    p_alcance: args.alcance,
    p_piezas: args.piezas,
    p_ancho_cm: args.anchoCm ?? null,
    p_alto_cm: args.altoCm ?? null,
  });
  if (error) throw new Error(error.message);
  const fila = data?.[0];
  return { precio: Number(fila?.precio ?? 0), cantidad: Number(fila?.cantidad ?? args.piezas) };
}

/**
 * Añade una línea del catálogo. Si `precio` es null se usa la tarifa;
 * si el admin lo ha cambiado a mano se guarda el precio escrito.
 */
export async function anadirLinea(
  documentoId: number,
  args: ArgsLinea & { precio: number | null; descuento: number; descripcion?: string; artista?: string },
) {
  await exigirAdmin();
  validarNumeros(args.piezas, args.precio, args.descuento);
  const supabase = await createClient();
  const { error } = await supabase.rpc("anadir_linea", {
    p_documento: documentoId,
    p_producto: args.productoId,
    p_formato: args.formatoId,
    p_alcance: args.alcance,
    p_piezas: args.piezas,
    p_ancho_cm: args.anchoCm ?? null,
    p_alto_cm: args.altoCm ?? null,
    p_precio: args.precio,
    p_descuento: args.descuento,
    p_descripcion: args.descripcion?.trim() || null,
    p_artista: args.artista?.trim() || null,
  });
  if (error) throw new Error(error.message);
  refrescar(documentoId);
}

/** Edición en la tabla de líneas: cantidad, precio unitario, descuento y concepto. */
export async function actualizarLinea(
  documentoId: number,
  lineaId: number,
  cambios: {
    piezas?: number;
    precio_unitario?: number;
    descuento_pct?: number;
    descripcion?: string;
    artista?: string | null;
  },
) {
  await exigirAdmin();
  validarNumeros(cambios.piezas, cambios.precio_unitario, cambios.descuento_pct);
  if (cambios.descripcion !== undefined && !cambios.descripcion.trim()) {
    throw new Error("El concepto no puede quedar vacío.");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("lineas_documento")
    .update(cambios.artista !== undefined ? { ...cambios, artista: cambios.artista?.trim() || null } : cambios)
    .eq("id", lineaId)
    .eq("documento_id", documentoId);
  if (error) throw new Error(error.message);
  refrescar(documentoId);
}

function validarNumeros(piezas?: number, precio?: number | null, descuento?: number) {
  if (piezas !== undefined && (!Number.isFinite(piezas) || piezas === 0)) {
    throw new Error("La cantidad no puede ser 0.");
  }
  if (precio != null && (!Number.isFinite(precio) || precio < 0)) {
    throw new Error("El precio no es válido.");
  }
  if (descuento !== undefined && (!Number.isFinite(descuento) || descuento < 0 || descuento > 100)) {
    throw new Error("El descuento va de 0 a 100 %.");
  }
}

export async function eliminarLinea(documentoId: number, lineaId: number) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lineas_documento")
    .delete()
    .eq("id", lineaId)
    .eq("documento_id", documentoId);
  if (error) throw new Error(error.message);
  refrescar(documentoId);
}

// ---------------------------------------------------------------------
//  Paso 3 · Campaña: dónde y cómo se instala la publicidad
// ---------------------------------------------------------------------

/** Enlaza el documento con una campaña existente del cliente (o la desenlaza con null). */
export async function vincularCampana(documentoId: number, campanaId: number | null) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("documentos").update({ campana_id: campanaId }).eq("id", documentoId);
  if (error) throw new Error(error.message);
  if (campanaId) {
    // Si la campaña aún no tenía documento de referencia, se queda con este.
    await supabase.from("campanas").update({ documento_id: documentoId }).eq("id", campanaId).is("documento_id", null);
  }
  refrescar(documentoId);
}

export async function crearCampana(
  documentoId: number,
  datos: { nombre: string; fecha_inicio?: string; fecha_fin?: string; descripcion?: string },
) {
  const admin = await exigirAdmin();
  const nombre = datos.nombre.trim();
  if (!nombre) throw new Error("La campaña necesita un nombre.");
  if (datos.fecha_inicio && datos.fecha_fin && datos.fecha_fin < datos.fecha_inicio) {
    throw new Error("La fecha de fin es anterior a la de inicio.");
  }
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documentos").select("cliente_id").eq("id", documentoId).single();
  if (!doc) throw new Error("No se ha encontrado el documento.");

  const { data, error } = await supabase
    .from("campanas")
    .insert({
      nombre,
      cliente_id: doc.cliente_id,
      documento_id: documentoId,
      fecha_inicio: datos.fecha_inicio || null,
      fecha_fin: datos.fecha_fin || null,
      descripcion: datos.descripcion?.trim() || null,
      creado_por: admin.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await supabase.from("documentos").update({ campana: nombre, campana_id: data.id }).eq("id", documentoId);
  refrescar(documentoId);
  revalidatePath("/admin/campanas");
  return data.id as number;
}

export async function anadirPunto(
  documentoId: number,
  campanaId: number,
  datos: {
    nombre: string;
    lineaId: number | null;
    piezas?: number | null;
    direccion?: string;
    latitud: number;
    longitud: number;
    fecha_colocacion_prevista?: string;
    fecha_retirada_prevista?: string;
    notas?: string;
  },
) {
  await exigirAdmin();
  if (!datos.nombre.trim()) throw new Error("Pon un nombre al punto (ej. «Farola Av. Andalucía 12»).");
  if (!Number.isFinite(datos.latitud) || !Number.isFinite(datos.longitud)) {
    throw new Error("Marca la ubicación en el mapa o busca la dirección.");
  }
  if (datos.piezas != null && (!Number.isFinite(datos.piezas) || datos.piezas <= 0)) {
    throw new Error("Las piezas del punto deben ser mayores que 0.");
  }
  const supabase = await createClient();

  // El soporte sale del artículo elegido (solo se pueden usar artículos del documento).
  let tipoSoporte: TipoSoporte = "otro";
  if (datos.lineaId != null) {
    const { data: linea } = await supabase
      .from("lineas_documento")
      .select("productos(nombre)")
      .eq("id", datos.lineaId)
      .eq("documento_id", documentoId)
      .maybeSingle();
    if (!linea) throw new Error("El artículo elegido no pertenece a este documento.");
    const producto = Array.isArray(linea.productos) ? linea.productos[0] : linea.productos;
    tipoSoporte = soporteDe(producto?.nombre ?? "");
  }

  const { error } = await supabase.from("puntos_campana").insert({
    campana_id: campanaId,
    nombre: datos.nombre.trim(),
    tipo_soporte: tipoSoporte,
    linea_id: datos.lineaId,
    piezas: datos.piezas ?? null,
    direccion: datos.direccion?.trim() || null,
    latitud: Math.round(datos.latitud * 1e7) / 1e7,
    longitud: Math.round(datos.longitud * 1e7) / 1e7,
    fecha_colocacion_prevista: datos.fecha_colocacion_prevista || null,
    fecha_retirada_prevista: datos.fecha_retirada_prevista || null,
    notas: datos.notas?.trim() || null,
  });
  if (error) throw new Error(error.message);
  refrescar(documentoId);
  revalidatePath(`/admin/campanas/${campanaId}`);
}

export async function eliminarPunto(documentoId: number, campanaId: number, puntoId: number) {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("puntos_campana")
    .delete()
    .eq("id", puntoId)
    .eq("campana_id", campanaId)
    .eq("estado", "pendiente");
  if (error) throw new Error(error.message);
  refrescar(documentoId);
  revalidatePath(`/admin/campanas/${campanaId}`);
}

/** Tipo de soporte (enum de la campaña) que corresponde a un producto del catálogo. */
function soporteDe(producto: string): TipoSoporte {
  const p = producto.toLowerCase();
  if (p.includes("tótem") || p.includes("totem")) return "totem";
  if (p.includes("valla")) return "valla";
  if (p.includes("lona")) return "lona";
  if (p.includes("banderola")) return "mobiliario_urbano";
  if (p.includes("marquesina")) return "marquesina";
  if (p.includes("pantalla")) return "pantalla";
  if (p.includes("cartel")) return "cartel";
  return "otro";
}
