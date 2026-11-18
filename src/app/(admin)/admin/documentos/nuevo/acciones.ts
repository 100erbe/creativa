"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import type { Database } from "@/lib/supabase/types";
import { soporteDe } from "@/lib/soporte";
import { siguienteNombrePunto } from "@/lib/campanas/nombre-punto";
import { accion, desenvolver } from "@/lib/accion";
import { guardarProducto } from "../../catalogo/acciones";

type Alcance = Database["public"]["Enums"]["alcance_servicio"];
type TipoSoporte = Database["public"]["Enums"]["tipo_soporte"];
export type TipoNuevoDocumento = "presupuesto" | "albaran" | "factura";

const TIPOS_PERMITIDOS: TipoNuevoDocumento[] = ["presupuesto", "albaran", "factura"];
const UNIDADES_LIBRES = ["ud", "m2", "ml", "millar", "mes", "servicio", "km"];
const IVAS_PERMITIDOS = [0, 4, 10, 21];

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
export const crearBorrador = accion(async (clienteId: number, tipo: TipoNuevoDocumento = "presupuesto") => {
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
});

/**
 * Cambia el tipo de un borrador (presupuesto ↔ albarán ↔ factura) manteniendo líneas y cliente.
 * Es seguro porque el número se asigna al emitir. No vale para documentos que vienen de otro
 * (una factura convertida o una versión de presupuesto), que deben conservar su tipo.
 */
export const cambiarTipo = accion(async (documentoId: number, tipo: TipoNuevoDocumento) => {
  await exigirAdmin();
  if (!TIPOS_PERMITIDOS.includes(tipo)) throw new Error("Tipo de documento no válido.");
  const supabase = await createClient();

  const { data: doc } = await supabase
    .from("documentos")
    .select("tipo, estado, documento_origen_id")
    .eq("id", documentoId)
    .maybeSingle();
  if (!doc) throw new Error("No se ha encontrado el documento.");
  if (doc.tipo === tipo) return;
  if (doc.estado !== "borrador") throw new Error("Solo se puede cambiar el tipo de un borrador.");
  if (doc.documento_origen_id) {
    throw new Error("Este documento viene de otro (conversión o versión) y no puede cambiar de tipo.");
  }
  if (!(TIPOS_PERMITIDOS as string[]).includes(doc.tipo)) {
    throw new Error("Este tipo de documento no se puede cambiar.");
  }

  const { data: serie } = await supabase
    .from("series")
    .select("id")
    .eq("tipo", tipo)
    .eq("por_defecto", true)
    .maybeSingle();
  if (!serie) throw new Error(`No hay una serie por defecto configurada para ${tipo}.`);

  const { error } = await supabase
    .from("documentos")
    .update({
      tipo,
      serie_id: serie.id,
      // Un presupuesto tiene «válido hasta»; los demás, vencimiento: se limpia lo que ya no aplica.
      ...(tipo === "presupuesto" ? { fecha_vencimiento: null, plazo_dias: null } : { valido_hasta: null }),
    })
    .eq("id", documentoId)
    .eq("estado", "borrador");
  if (error) throw new Error(error.message);
  refrescar(documentoId);
});

/** "Cambiar" cliente de un borrador ya creado (mantiene las líneas). */
export const cambiarCliente = accion(async (documentoId: number, clienteId: number) => {
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
});

type ArgsLinea = {
  productoId: number;
  formatoId: number | null;
  alcance: Alcance;
  piezas: number;
  anchoCm?: number | null;
  altoCm?: number | null;
};

/** Precio de tarifa (cliente > tipo de cliente > volumen > formato > producto). */
export const previsualizarPrecio = accion(async (args: ArgsLinea & { clienteId: number }) => {
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
});

/**
 * Añade una línea del catálogo. Si `precio` es null se usa la tarifa;
 * si el admin lo ha cambiado a mano se guarda el precio escrito.
 */
export const anadirLinea = accion(async (
  documentoId: number,
  args: ArgsLinea & { precio: number | null; descuento: number; descripcion?: string; artista?: string },
) => {
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
});

/** Concepto que no está en el catálogo (un desplazamiento, un trabajo suelto…): sin tarifa, con precio manual (y opción de guardarlo en el catálogo). */
export const anadirLineaLibre = accion(
  async (
    documentoId: number,
    args: {
      descripcion: string;
      artista?: string;
      unidad: string;
      piezas: number;
      precio: number;
      descuento: number;
      iva: number;
      guardarEnCatalogo?: boolean;
      categoriaId?: number;
      alcanceCatalogo?: Alcance;
    },
  ) => {
    await exigirAdmin();
    const descripcion = args.descripcion.trim();
    if (!descripcion) throw new Error("Escribe el concepto.");
    if (!UNIDADES_LIBRES.includes(args.unidad)) throw new Error("Unidad no válida.");
    if (!IVAS_PERMITIDOS.includes(args.iva)) throw new Error("IVA no válido.");
    validarNumeros(args.piezas, args.precio, args.descuento);
    if (!Number.isFinite(args.precio)) throw new Error("Indica el precio.");
    if (args.guardarEnCatalogo && (!args.categoriaId || !Number.isInteger(args.categoriaId) || args.categoriaId <= 0)) {
      throw new Error("Elige una categoría para guardar el artículo en el catálogo.");
    }
    const supabase = await createClient();

    const { data: doc } = await supabase.from("documentos").select("estado").eq("id", documentoId).maybeSingle();
    if (!doc) throw new Error("No se ha encontrado el documento.");
    if (doc.estado !== "borrador") throw new Error("Solo se pueden añadir líneas a un borrador.");

    if (args.guardarEnCatalogo && args.categoriaId) {
      const alcance: Alcance =
        args.alcanceCatalogo && ["fabricacion", "instalacion", "fabricacion_instalacion"].includes(args.alcanceCatalogo)
          ? args.alcanceCatalogo
          : "fabricacion_instalacion";

      const nuevoProductoId = await desenvolver(
        guardarProducto(null, {
          categoriaId: args.categoriaId,
          nombre: descripcion,
          unidadVenta: args.unidad,
          admiteMedidaLibre: false,
          permiteFabricacion: alcance !== "instalacion",
          permiteInstalacion: alcance !== "fabricacion",
          precioFabricacion: alcance === "instalacion" ? null : args.precio,
          precioInstalacion: alcance === "instalacion" ? args.precio : null,
          pedidoMinimo: null,
          ivaPct: args.iva,
          activo: true,
        }),
      );

      const { error: errorRpc } = await supabase.rpc("anadir_linea", {
        p_documento: documentoId,
        p_producto: nuevoProductoId,
        p_formato: null,
        p_alcance: alcance,
        p_piezas: args.piezas,
        p_ancho_cm: null,
        p_alto_cm: null,
        p_precio: args.precio,
        p_descuento: args.descuento,
        p_descripcion: descripcion,
        p_artista: args.artista?.trim() || null,
      });
      if (errorRpc) throw new Error(errorRpc.message);
      refrescar(documentoId);
      return;
    }

    const { data: ultima } = await supabase
      .from("lineas_documento")
      .select("orden")
      .eq("documento_id", documentoId)
      .order("orden", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("lineas_documento").insert({
      documento_id: documentoId,
      orden: (ultima?.orden ?? 0) + 1,
      descripcion,
      artista: args.artista?.trim() || null,
      unidad: args.unidad as Database["public"]["Enums"]["unidad_venta"],
      piezas: args.piezas,
      precio_unitario: args.precio,
      descuento_pct: args.descuento,
      iva_pct: args.iva,
    });
    if (error) throw new Error(error.message);
    refrescar(documentoId);
  },
);

/** Edición en la tabla de líneas: cantidad, precio unitario, descuento y concepto. */
export const actualizarLinea = accion(async (
  documentoId: number,
  lineaId: number,
  cambios: {
    piezas?: number;
    precio_unitario?: number;
    descuento_pct?: number;
    descripcion?: string;
    artista?: string | null;
  },
) => {
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
});

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

export const eliminarLinea = accion(async (documentoId: number, lineaId: number) => {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("lineas_documento")
    .delete()
    .eq("id", lineaId)
    .eq("documento_id", documentoId);
  if (error) throw new Error(error.message);
  refrescar(documentoId);
});

// ---------------------------------------------------------------------
//  Paso 3 · Campaña: dónde y cómo se instala la publicidad
// ---------------------------------------------------------------------

/** Enlaza el documento con una campaña existente del cliente (o la desenlaza con null). */
export const vincularCampana = accion(async (documentoId: number, campanaId: number | null) => {
  await exigirAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("documentos").update({ campana_id: campanaId }).eq("id", documentoId);
  if (error) throw new Error(error.message);
  if (campanaId) {
    // Si la campaña aún no tenía documento de referencia, se queda con este.
    await supabase.from("campanas").update({ documento_id: documentoId }).eq("id", campanaId).is("documento_id", null);
  }
  refrescar(documentoId);
});

export const crearCampana = accion(async (
  documentoId: number,
  datos: { nombre: string; fecha_inicio?: string; fecha_fin?: string; descripcion?: string },
) => {
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
});

export const anadirPunto = accion(async (
  documentoId: number,
  campanaId: number,
  datos: {
    lineaId: number | null;
    piezas?: number | null;
    direccion?: string;
    latitud: number;
    longitud: number;
    fecha_colocacion_prevista?: string;
    fecha_retirada_prevista?: string;
    notas?: string;
  },
) => {
  await exigirAdmin();
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

  // Sin nombre a mano: "Punto N", el siguiente número libre de la campaña.
  const { data: existentes, error: errorNombres } = await supabase
    .from("puntos_campana")
    .select("nombre")
    .eq("campana_id", campanaId);
  if (errorNombres) throw new Error(errorNombres.message);

  const { data: creado, error } = await supabase
    .from("puntos_campana")
    .insert({
      campana_id: campanaId,
      nombre: siguienteNombrePunto((existentes ?? []).map((p) => p.nombre)),
      tipo_soporte: tipoSoporte,
      linea_id: datos.lineaId,
      piezas: datos.piezas ?? null,
      direccion: datos.direccion?.trim() || null,
      latitud: Math.round(datos.latitud * 1e7) / 1e7,
      longitud: Math.round(datos.longitud * 1e7) / 1e7,
      fecha_colocacion_prevista: datos.fecha_colocacion_prevista || null,
      fecha_retirada_prevista: datos.fecha_retirada_prevista || null,
      notas: datos.notas?.trim() || null,
    })
    .select(
      "id, nombre, tipo_soporte, linea_id, piezas, direccion, latitud, longitud, fecha_colocacion_prevista, fecha_retirada_prevista, estado, notas",
    )
    .single();
  if (error || !creado) throw new Error(error?.message ?? "No se pudo guardar el punto.");
  refrescar(documentoId);
  revalidatePath(`/admin/campanas/${campanaId}`);
  return {
    ...creado,
    piezas: creado.piezas == null ? null : Number(creado.piezas),
    latitud: Number(creado.latitud),
    longitud: Number(creado.longitud),
  };
});

export const moverPunto = accion(async (
  documentoId: number,
  campanaId: number,
  puntoId: number,
  latitud: number,
  longitud: number,
  direccion?: string,
) => {
  await exigirAdmin();
  if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
    throw new Error("Ubicación no válida.");
  }
  const supabase = await createClient();
  const cambios: { latitud: number; longitud: number; direccion?: string | null } = {
    latitud: Math.round(latitud * 1e7) / 1e7,
    longitud: Math.round(longitud * 1e7) / 1e7,
  };
  if (direccion !== undefined) cambios.direccion = direccion.trim() || null;
  const { error } = await supabase
    .from("puntos_campana")
    .update(cambios)
    .eq("id", puntoId)
    .eq("campana_id", campanaId);
  if (error) throw new Error(error.message);
  refrescar(documentoId);
  revalidatePath(`/admin/campanas/${campanaId}`);
});

export const actualizarPunto = accion(async (
  documentoId: number,
  campanaId: number,
  puntoId: number,
  datos: {
    lineaId: number | null;
    piezas?: number | null;
    direccion?: string;
    fecha_colocacion_prevista?: string;
    fecha_retirada_prevista?: string;
    notas?: string;
  },
) => {
  await exigirAdmin();
  if (datos.piezas != null && (!Number.isFinite(datos.piezas) || datos.piezas <= 0)) {
    throw new Error("Las piezas del punto deben ser mayores que 0.");
  }
  if (
    datos.fecha_colocacion_prevista &&
    datos.fecha_retirada_prevista &&
    datos.fecha_retirada_prevista < datos.fecha_colocacion_prevista
  ) {
    throw new Error("La fecha de retirada es anterior a la de colocación.");
  }
  const supabase = await createClient();

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

  const { error } = await supabase
    .from("puntos_campana")
    .update({
      tipo_soporte: tipoSoporte,
      linea_id: datos.lineaId,
      piezas: datos.piezas ?? null,
      direccion: datos.direccion?.trim() || null,
      fecha_colocacion_prevista: datos.fecha_colocacion_prevista || null,
      fecha_retirada_prevista: datos.fecha_retirada_prevista || null,
      notas: datos.notas?.trim() || null,
    })
    .eq("id", puntoId)
    .eq("campana_id", campanaId);
  if (error) throw new Error(error.message);
  refrescar(documentoId);
  revalidatePath(`/admin/campanas/${campanaId}`);
});

export const eliminarPunto = accion(async (documentoId: number, campanaId: number, puntoId: number) => {
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
});
