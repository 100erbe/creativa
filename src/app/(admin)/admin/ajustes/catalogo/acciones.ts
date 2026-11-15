"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";

const IVAS = [0, 4, 10, 21];

function precioValido(v: number | null, nombre: string) {
  if (v != null && (!Number.isFinite(v) || v < 0)) throw new Error(`El precio de ${nombre} no es válido.`);
}

function refrescar() {
  revalidatePath("/admin/ajustes/catalogo");
  revalidatePath("/admin/documentos/nuevo");
}

/**
 * Cambia el precio, el IVA o la disponibilidad de un producto. Los documentos que ya tienen la línea
 * guardada no cambian: cada línea conserva el precio con el que se creó.
 */
export const actualizarProducto = accion(
  async (
    id: number,
    d: { nombre: string; precioFabricacion: number | null; precioInstalacion: number | null; ivaPct: number; activo: boolean },
  ) => {
    await exigirAdmin();
    const nombre = d.nombre.trim();
    if (!nombre) throw new Error("El producto necesita un nombre.");
    precioValido(d.precioFabricacion, "fabricación");
    precioValido(d.precioInstalacion, "instalación");
    if (!IVAS.includes(d.ivaPct)) throw new Error("IVA no válido.");
    const supabase = await createClient();

    const { error } = await supabase
      .from("productos")
      .update({
        nombre,
        precio_fabricacion: d.precioFabricacion,
        precio_instalacion: d.precioInstalacion,
        iva_pct: d.ivaPct,
        activo: d.activo,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    refrescar();
  },
);

/** Un formato con precio propio manda sobre el del producto; vacío = usa el del producto. */
export const actualizarFormato = accion(
  async (id: number, d: { precioFabricacion: number | null; precioInstalacion: number | null; activo: boolean }) => {
    await exigirAdmin();
    precioValido(d.precioFabricacion, "fabricación");
    precioValido(d.precioInstalacion, "instalación");
    const supabase = await createClient();

    const { error } = await supabase
      .from("formatos")
      .update({ precio_fabricacion: d.precioFabricacion, precio_instalacion: d.precioInstalacion, activo: d.activo })
      .eq("id", id);
    if (error) throw new Error(error.message);
    refrescar();
  },
);
