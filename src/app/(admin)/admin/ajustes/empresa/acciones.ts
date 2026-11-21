"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";

const esquema = z.object({
  nombre_comercial: z.string().trim().min(1, "El nombre comercial es obligatorio."),
  razon_social: z.string().trim().min(1, "La razón social es obligatoria."),
  nif: z.string().trim().min(1, "El NIF es obligatorio."),
  direccion: z.string().trim().min(1, "La dirección es obligatoria."),
  codigo_postal: z.string().trim(),
  municipio: z.string().trim(),
  provincia: z.string().trim(),
  telefono: z.string().trim(),
  movil: z.string().trim(),
  email: z.union([z.literal(""), z.string().trim().email("El email no es válido.")]),
  lema: z.string().trim(),
  validez_presupuesto_dias: z.number().int("Los días de validez son un número entero.").min(1, "Mínimo 1 día.").max(365, "Máximo 365 días."),
  vencimiento_defecto_dias: z.number().int("Los días de vencimiento son un número entero.").min(0, "Mínimo 0 días.").max(365, "Máximo 365 días."),
});

export type DatosEmpresa = z.input<typeof esquema>;

/** Datos fiscales y de contacto que se imprimen en los documentos. Los ya emitidos no cambian de contenido guardado, pero su impresión usa estos datos. */
export const guardarEmpresa = accion(async (datos: DatosEmpresa) => {
  await exigirAdmin();
  const analisis = esquema.safeParse(datos);
  if (!analisis.success) throw new Error(analisis.error.issues[0]?.message ?? "Revisa los datos.");
  const d = analisis.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("empresa")
    .update({
      nombre_comercial: d.nombre_comercial,
      razon_social: d.razon_social,
      nif: d.nif,
      direccion: d.direccion,
      codigo_postal: d.codigo_postal || null,
      municipio: d.municipio || null,
      provincia: d.provincia || null,
      telefono: d.telefono || null,
      movil: d.movil || null,
      email: d.email || null,
      lema: d.lema || null,
      validez_presupuesto_dias: d.validez_presupuesto_dias,
      vencimiento_defecto_dias: d.vencimiento_defecto_dias,
    })
    .eq("id", 1);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/ajustes/empresa");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/documentos");
});
