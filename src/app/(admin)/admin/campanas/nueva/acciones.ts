"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Campaña creada directamente (sin pasar por un documento). Devuelve su id. */
export const crearCampanaNueva = accion(
  async (datos: { clienteId: number; nombre: string; fechaInicio: string; fechaFin: string; descripcion: string }) => {
    const admin = await exigirAdmin();
    const nombre = datos.nombre.trim();
    if (!nombre) throw new Error("La campaña necesita un nombre.");
    if (!Number.isInteger(datos.clienteId) || datos.clienteId <= 0) throw new Error("Elige el cliente.");
    for (const f of [datos.fechaInicio, datos.fechaFin]) if (f && !FECHA.test(f)) throw new Error("Fecha no válida.");
    if (datos.fechaInicio && datos.fechaFin && datos.fechaFin < datos.fechaInicio) {
      throw new Error("La fecha de fin es anterior a la de inicio.");
    }
    const supabase = await createClient();

    const { data, error } = await supabase
      .from("campanas")
      .insert({
        nombre,
        cliente_id: datos.clienteId,
        fecha_inicio: datos.fechaInicio || null,
        fecha_fin: datos.fechaFin || null,
        descripcion: datos.descripcion.trim() || null,
        creado_por: admin.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    revalidatePath("/admin/campanas");
    return data.id as number;
  },
);
