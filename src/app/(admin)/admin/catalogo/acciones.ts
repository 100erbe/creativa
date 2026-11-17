"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";
import type { Database } from "@/lib/supabase/types";

type UnidadVenta = Database["public"]["Enums"]["unidad_venta"];

const UNIDADES: readonly UnidadVenta[] = ["ud", "m2", "ml", "millar", "mes", "servicio", "km"];
const IVAS = [0, 4, 10, 21];

function precioValido(v: number | null, nombre: string) {
  if (v != null && (!Number.isFinite(v) || v < 0)) {
    throw new Error(`El precio de ${nombre} no es válido.`);
  }
}

function aSlugCodigo(texto: string, maxLen = 8) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toUpperCase()
    .slice(0, maxLen);
}

function codigoBaseProducto(catCodigo: string, nombre: string) {
  const palabras = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const sufijo =
    palabras.length >= 2
      ? `${palabras[0]!.slice(0, 3)}${palabras[1]!.slice(0, 3)}`.toUpperCase()
      : (palabras[0] ?? "ART").slice(0, 6).toUpperCase();
  return `${catCodigo}-${sufijo || "ART"}`;
}

function codigoBaseFormato(nombre: string, anchoCm: number | null, altoCm: number | null) {
  if (anchoCm != null && altoCm != null) {
    return `${anchoCm}x${altoCm}`;
  }
  const limpio = nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/[^a-zA-Z0-9xX._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 20);
  return limpio || "FMT";
}

function refrescar() {
  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/ajustes/catalogo");
  revalidatePath("/admin/documentos/nuevo");
}

/** Crea o edita una categoría del catálogo. */
export const guardarCategoria = accion(
  async (id: number | null, d: { nombre: string; codigo?: string; orden?: number }) => {
    await exigirAdmin();
    const nombre = d.nombre.trim();
    if (!nombre) throw new Error("La categoría necesita un nombre.");

    const codigoManual = d.codigo?.trim().toUpperCase().replace(/\s+/g, "-") || "";
    const ordenExplicito = d.orden != null && Number.isFinite(d.orden) ? Math.trunc(d.orden) : undefined;
    const supabase = await createClient();

    if (id != null) {
      const { error } = await supabase
        .from("categorias")
        .update({
          nombre,
          ...(codigoManual ? { codigo: codigoManual } : {}),
          ...(ordenExplicito !== undefined ? { orden: ordenExplicito } : {}),
        })
        .eq("id", id);
      if (error) {
        if (error.code === "23505") throw new Error("Ya existe una categoría con ese código.");
        throw new Error(error.message);
      }
      refrescar();
      return id;
    }

    let orden = ordenExplicito;
    if (orden === undefined) {
      const { data: ultima } = await supabase
        .from("categorias")
        .select("orden")
        .order("orden", { ascending: false })
        .limit(1)
        .maybeSingle();
      orden = (ultima?.orden ?? 0) + 1;
    }

    const base = codigoManual || aSlugCodigo(nombre, 3) || "CAT";
    const maxIntentos = codigoManual ? 1 : 10;
    for (let i = 0; i < maxIntentos; i++) {
      const codigo = i === 0 ? base : `${base}${i + 1}`;
      const { data, error } = await supabase
        .from("categorias")
        .insert({ codigo, nombre, orden })
        .select("id")
        .single();
      if (!error && data) {
        refrescar();
        return data.id as number;
      }
      if (error?.code === "23505") {
        if (codigoManual) throw new Error("Ya existe una categoría con ese código.");
        continue;
      }
      throw new Error(error?.message ?? "No se pudo crear la categoría.");
    }
    throw new Error("No se pudo asignar un código único para la categoría.");
  },
);

export type DatosProducto = {
  codigo?: string;
  categoriaId: number;
  nombre: string;
  descripcionFactura?: string;
  material?: string;
  unidadVenta: string;
  admiteMedidaLibre: boolean;
  permiteFabricacion: boolean;
  permiteInstalacion: boolean;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  pedidoMinimo: number | null;
  ivaPct: number;
  activo: boolean;
  notas?: string;
};

/**
 * Crea o actualiza un producto o servicio del catálogo.
 * Los documentos emitidos o con líneas ya creadas conservan sus propios precios e importes.
 */
export const guardarProducto = accion(async (id: number | null, d: DatosProducto) => {
  await exigirAdmin();
  const nombre = d.nombre.trim();
  if (!nombre) throw new Error("El producto o servicio necesita un nombre.");
  if (!Number.isInteger(d.categoriaId) || d.categoriaId <= 0) {
    throw new Error("Elige una categoría válida.");
  }
  const unidad = UNIDADES.find((u) => u === d.unidadVenta);
  if (!unidad) throw new Error("Unidad de venta no válida.");
  if (!IVAS.includes(d.ivaPct)) throw new Error("IVA no válido.");
  if (!d.permiteFabricacion && !d.permiteInstalacion) {
    throw new Error("Marca al menos fabricación/suministro o instalación/servicio.");
  }
  precioValido(d.precioFabricacion, "fabricación");
  precioValido(d.precioInstalacion, "instalación");
  if (d.pedidoMinimo != null && (!Number.isFinite(d.pedidoMinimo) || d.pedidoMinimo <= 0)) {
    throw new Error("El pedido mínimo debe ser mayor que 0.");
  }

  const admiteMedidaLibre = unidad === "m2" || unidad === "ml" ? Boolean(d.admiteMedidaLibre) : false;
  const pedidoMinimo = unidad === "m2" ? d.pedidoMinimo : null;
  const codigoManual = d.codigo?.trim().toUpperCase().replace(/\s+/g, "-") || "";

  const campos = {
    categoria_id: d.categoriaId,
    nombre,
    descripcion_factura: d.descripcionFactura?.trim() || null,
    material: d.material?.trim() || null,
    unidad_venta: unidad,
    admite_medida_libre: admiteMedidaLibre,
    permite_fabricacion: d.permiteFabricacion,
    permite_instalacion: d.permiteInstalacion,
    precio_fabricacion: d.precioFabricacion,
    precio_instalacion: d.precioInstalacion,
    pedido_minimo: pedidoMinimo,
    iva_pct: d.ivaPct,
    activo: d.activo,
    notas: d.notas?.trim() || null,
  };

  const supabase = await createClient();

  if (id != null) {
    const { error } = await supabase
      .from("productos")
      .update({
        ...campos,
        ...(codigoManual ? { codigo: codigoManual } : {}),
      })
      .eq("id", id);
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe otro producto o servicio con ese código.");
      throw new Error(error.message);
    }
    refrescar();
    return id;
  }

  let base = codigoManual;
  if (!base) {
    const { data: cat } = await supabase
      .from("categorias")
      .select("codigo")
      .eq("id", d.categoriaId)
      .maybeSingle();
    if (!cat) throw new Error("La categoría seleccionada no existe.");
    base = codigoBaseProducto(cat.codigo, nombre);
  }

  const maxIntentos = codigoManual ? 1 : 20;
  for (let i = 0; i < maxIntentos; i++) {
    const codigo = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await supabase
      .from("productos")
      .insert({ ...campos, codigo })
      .select("id")
      .single();
    if (!error && data) {
      refrescar();
      return data.id as number;
    }
    if (error?.code === "23505") {
      if (codigoManual) throw new Error("Ya existe un producto o servicio con ese código.");
      continue;
    }
    throw new Error(error?.message ?? "No se pudo guardar el producto.");
  }

  throw new Error("No se pudo generar un código único. Escribe uno manualmente.");
});

/** Elimina un producto creado por error (si no aparece en documentos ni plantillas). */
export const eliminarProducto = accion(async (id: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const [{ count: lineas }, { count: plantillas }] = await Promise.all([
    supabase.from("lineas_documento").select("id", { count: "exact", head: true }).eq("producto_id", id),
    supabase.from("plantillas_linea").select("id", { count: "exact", head: true }).eq("producto_id", id),
  ]);
  if ((lineas ?? 0) > 0 || (plantillas ?? 0) > 0) {
    throw new Error(
      "Este producto o servicio ya se ha usado en documentos o plantillas y no se puede eliminar. Desactívalo en su lugar.",
    );
  }

  const { error } = await supabase.from("productos").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error(
        "Este producto o servicio tiene datos asociados y no se puede eliminar. Desactívalo en su lugar.",
      );
    }
    throw new Error(error.message);
  }
  refrescar();
});

export type DatosFormato = {
  productoId: number;
  codigo?: string;
  nombre: string;
  anchoCm: number | null;
  altoCm: number | null;
  precioFabricacion: number | null;
  precioInstalacion: number | null;
  alias?: string;
  activo: boolean;
};

/** Crea o actualiza un formato concreto de un producto (medidas, precios propios y alias de búsqueda). */
export const guardarFormato = accion(async (id: number | null, d: DatosFormato) => {
  await exigirAdmin();
  const nombre = d.nombre.trim();
  if (!nombre) throw new Error("El formato necesita un nombre.");

  const tieneAncho = d.anchoCm != null;
  const tieneAlto = d.altoCm != null;
  if (tieneAncho !== tieneAlto) {
    throw new Error("Indica tanto el ancho como el alto en cm, o deja ambos vacíos.");
  }
  if (tieneAncho && (!Number.isFinite(d.anchoCm!) || d.anchoCm! <= 0 || !Number.isFinite(d.altoCm!) || d.altoCm! <= 0)) {
    throw new Error("Las medidas deben ser mayores que 0.");
  }
  precioValido(d.precioFabricacion, "fabricación");
  precioValido(d.precioInstalacion, "instalación");

  const aliasLista = (d.alias ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const alias = aliasLista.length > 0 ? aliasLista : null;
  const codigoManual = d.codigo?.trim().toUpperCase().replace(/\s+/g, "-") || "";

  const campos = {
    nombre,
    ancho_cm: d.anchoCm,
    alto_cm: d.altoCm,
    precio_fabricacion: d.precioFabricacion,
    precio_instalacion: d.precioInstalacion,
    alias,
    activo: d.activo,
  };

  const supabase = await createClient();

  if (id != null) {
    const { error } = await supabase
      .from("formatos")
      .update({
        ...campos,
        ...(codigoManual ? { codigo: codigoManual } : {}),
      })
      .eq("id", id);
    if (error) {
      if (error.code === "23505") throw new Error("Ya existe otro formato con ese código en este producto.");
      throw new Error(error.message);
    }
    refrescar();
    return id;
  }

  const base = codigoManual || codigoBaseFormato(nombre, d.anchoCm, d.altoCm);
  const maxIntentos = codigoManual ? 1 : 15;
  for (let i = 0; i < maxIntentos; i++) {
    const codigo = i === 0 ? base : `${base}-${i + 1}`;
    const { data, error } = await supabase
      .from("formatos")
      .insert({ ...campos, producto_id: d.productoId, codigo })
      .select("id")
      .single();
    if (!error && data) {
      refrescar();
      return data.id as number;
    }
    if (error?.code === "23505") {
      if (codigoManual) throw new Error("Ya existe un formato con ese código en este producto.");
      continue;
    }
    throw new Error(error?.message ?? "No se pudo guardar el formato.");
  }
  throw new Error("No se pudo asignar un código único al formato.");
});

/** Elimina un formato creado por error (si no está referenciado en documentos). */
export const eliminarFormato = accion(async (id: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const [{ count: lineas }, { count: plantillas }] = await Promise.all([
    supabase.from("lineas_documento").select("id", { count: "exact", head: true }).eq("formato_id", id),
    supabase.from("plantillas_linea").select("id", { count: "exact", head: true }).eq("formato_id", id),
  ]);
  if ((lineas ?? 0) > 0 || (plantillas ?? 0) > 0) {
    throw new Error("Este formato ya se ha usado en documentos o plantillas. Desactívalo en su lugar.");
  }

  const { error } = await supabase.from("formatos").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      throw new Error("Este formato tiene datos asociados y no se puede eliminar. Desactívalo en su lugar.");
    }
    throw new Error(error.message);
  }
  refrescar();
});
