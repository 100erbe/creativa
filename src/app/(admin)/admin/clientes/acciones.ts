"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { VALORES_TIPO_CLIENTE, VALORES_REGIMEN_IVA, TIPOS_DOCUMENTO_ID } from "@/lib/clientes";
import { accion } from "@/lib/accion";

export type EstadoFormulario = { error?: string };

const esquema = z
  .object({
    razon_social: z.string().min(2, "La razón social es obligatoria."),
    nombre_comercial: z.string().nullable(),
    tipo_persona: z.enum(["juridica", "fisica"]),
    tipo_documento: z.enum(TIPOS_DOCUMENTO_ID),
    numero_documento: z.string().nullable(),
    direccion: z.string().nullable(),
    codigo_postal: z.string().nullable(),
    municipio: z.string().nullable(),
    provincia: z.string().nullable(),
    pais: z.string().length(2, "El país son 2 letras (ES, FR…)."),
    email_facturacion: z.string().email("El email no es válido.").nullable(),
    telefono: z.string().nullable(),
    web: z.string().nullable(),
    tipo_cliente: z.enum(VALORES_TIPO_CLIENTE),
    grupo_id: z.number().int().nullable(),
    regimen_iva: z.enum(VALORES_REGIMEN_IVA),
    motivo_exencion: z.string().nullable(),
    forma_pago_id: z.number().int().nullable(),
    dias_vencimiento: z
      .number()
      .int("Los días de vencimiento son un número entero.")
      .min(0, "El vencimiento va de 0 a 365 días.")
      .max(365, "El vencimiento va de 0 a 365 días.")
      .nullable(),
    vencimiento_dia_mes: z
      .number()
      .int("El día de vencimiento es un número entero.")
      .min(1, "El día de vencimiento va de 1 a 31.")
      .max(31, "El día de vencimiento va de 1 a 31.")
      .nullable(),
    cuenta_cobro_id: z.number().int().nullable(),
    descuento_habitual: z.number().min(0, "El descuento va de 0 a 100.").max(100, "El descuento va de 0 a 100."),
    notas: z.string().nullable(),
  })
  .refine((d) => !["exento", "intracomunitario"].includes(d.regimen_iva) || !!d.motivo_exencion, {
    message: "Un cliente exento o intracomunitario necesita el motivo de la exención.",
    path: ["motivo_exencion"],
  });

function leer(formData: FormData) {
  const t = (k: string) => {
    const v = formData.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const n = (k: string) => {
    const v = t(k);
    return v === null ? null : Number(v.replace(",", "."));
  };
  return {
    razon_social: t("razon_social") ?? "",
    nombre_comercial: t("nombre_comercial"),
    tipo_persona: t("tipo_persona") ?? "juridica",
    tipo_documento: t("tipo_documento") ?? "CIF",
    numero_documento: t("numero_documento"),
    direccion: t("direccion"),
    codigo_postal: t("codigo_postal"),
    municipio: t("municipio"),
    provincia: t("provincia"),
    pais: (t("pais") ?? "ES").toUpperCase(),
    email_facturacion: t("email_facturacion"),
    telefono: t("telefono"),
    web: t("web"),
    tipo_cliente: t("tipo_cliente") ?? "marca_empresa",
    grupo_id: n("grupo_id"),
    regimen_iva: t("regimen_iva") ?? "general",
    motivo_exencion: t("motivo_exencion"),
    forma_pago_id: n("forma_pago_id"),
    // «Día N del mes siguiente» y «N días» se excluyen: si hay día del mes, los días quedan vacíos.
    vencimiento_dia_mes: n("vencimiento_dia_mes"),
    dias_vencimiento: n("vencimiento_dia_mes") != null ? null : n("dias_vencimiento"),
    cuenta_cobro_id: n("cuenta_cobro_id"),
    descuento_habitual: n("descuento_habitual") ?? 0,
    notas: t("notas"),
  };
}

/** Crea o actualiza un cliente (según venga o no el campo oculto "id"). */
export async function guardarCliente(
  _previo: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await exigirAdmin();

  const idCampo = formData.get("id");
  const id = typeof idCampo === "string" && idCampo ? Number(idCampo) : null;

  const analisis = esquema.safeParse(leer(formData));
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  }
  // Un régimen general/reducido no necesita motivo de exención.
  const datos = {
    ...analisis.data,
    motivo_exencion: ["exento", "intracomunitario"].includes(analisis.data.regimen_iva)
      ? analisis.data.motivo_exencion
      : null,
  };

  const supabase = await createClient();
  let destino: number;

  if (id) {
    const { error } = await supabase
      .from("clientes")
      .update(datos)
      .eq("id", id);
    if (error) return { error: mensajeError(error) };
    destino = id;
  } else {
    const r = await insertarConCodigo(supabase, datos);
    if ("error" in r) return { error: r.error };
    destino = r.id;
  }

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${destino}`);
  // El nombre y los datos del cliente salen en documentos, cobros y el panel.
  revalidatePath("/admin/documentos", "layout");
  revalidatePath("/admin/cobros");
  revalidatePath("/admin/panel");
  redirect(`/admin/clientes/${destino}`);
}

type DatosCliente = z.infer<typeof esquema>;

/** El código (CLI-061…) no tiene valor por defecto en la base: se calcula aquí. */
async function insertarConCodigo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  datos: DatosCliente,
): Promise<{ id: number } | { error: string }> {
  for (let intento = 0; intento < 3; intento++) {
    const { data: codigos } = await supabase.from("clientes").select("codigo").like("codigo", "CLI-%");
    const mayor = (codigos ?? []).reduce((m, c) => Math.max(m, Number(c.codigo.slice(4)) || 0), 0);
    const codigo = `CLI-${String(mayor + 1).padStart(3, "0")}`;

    const { data, error } = await supabase
      .from("clientes")
      .insert({ ...datos, codigo })
      .select("id")
      .single();
    if (!error && data) return { id: data.id };
    if (error && !(error.code === "23505" && error.message.includes("clientes_codigo_key"))) {
      return { error: mensajeError(error) }; // otro error: no tiene sentido reintentar
    }
  }
  return { error: "No se pudo asignar un código de cliente. Inténtalo de nuevo." };
}

/**
 * Alta rápida desde el asistente de documentos: solo los datos fiscales
 * básicos; el resto se completa luego en la ficha del cliente.
 */
export async function crearClienteRapido(campos: {
  razon_social: string;
  nombre_comercial?: string;
  tipo_persona?: string;
  tipo_documento?: string;
  numero_documento?: string;
  direccion?: string;
  codigo_postal?: string;
  municipio?: string;
  provincia?: string;
  email_facturacion?: string;
  telefono?: string;
  tipo_cliente?: string;
}): Promise<
  | { cliente: { id: number; razon_social: string; nombre_comercial: string | null; numero_documento: string | null } }
  | { error: string }
> {
  await exigirAdmin();
  const fd = new FormData();
  for (const [k, v] of Object.entries(campos)) if (v) fd.set(k, v);
  const analisis = esquema.safeParse(leer(fd));
  if (!analisis.success) {
    return { error: analisis.error.issues[0]?.message ?? "Revisa los datos del cliente." };
  }

  const supabase = await createClient();
  const r = await insertarConCodigo(supabase, analisis.data);
  if ("error" in r) return r;

  revalidatePath("/admin/clientes");
  return {
    cliente: {
      id: r.id,
      razon_social: analisis.data.razon_social,
      nombre_comercial: analisis.data.nombre_comercial,
      numero_documento: analisis.data.numero_documento,
    },
  };
}

function mensajeError(error: { code?: string; message: string }) {
  if (error.code === "23505") return "Ya existe un cliente con ese documento y esa razón social.";
  if (error.message.includes("exencion_motivada")) {
    return "Un cliente exento o intracomunitario necesita el motivo de la exención.";
  }
  return error.message;
}

/** Los clientes con documentos no se borran: se desactivan y dejan de salir al crear documentos. */
export const cambiarActivo = accion(async (clienteId: number, activo: boolean) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase.from("clientes").update({ activo }).eq("id", clienteId);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clienteId}`);
});

export const anadirContacto = accion(async (
  clienteId: number,
  datos: { nombre: string; cargo?: string; email?: string; telefono?: string; recibeFacturas: boolean },
) => {
  await exigirAdmin();
  const nombre = datos.nombre.trim();
  if (!nombre) throw new Error("El nombre del contacto es obligatorio.");
  const email = datos.email?.trim() || null;
  if (email && !z.string().email().safeParse(email).success) throw new Error("El email no es válido.");

  const supabase = await createClient();
  const { error } = await supabase.from("contactos_cliente").insert({
    cliente_id: clienteId,
    nombre,
    cargo: datos.cargo?.trim() || null,
    email,
    telefono: datos.telefono?.trim() || null,
    recibe_facturas: datos.recibeFacturas,
  });
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/clientes/${clienteId}`);
});

export const eliminarContacto = accion(async (clienteId: number, contactoId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("contactos_cliente")
    .delete()
    .eq("id", contactoId)
    .eq("cliente_id", clienteId);
  if (error) throw new Error(error.message);

  revalidatePath(`/admin/clientes/${clienteId}`);
});

/** Corrige un contacto ya guardado. */
export const actualizarContacto = accion(
  async (
    clienteId: number,
    contactoId: number,
    datos: { nombre: string; cargo?: string; email?: string; telefono?: string; recibeFacturas: boolean },
  ) => {
    await exigirAdmin();
    const nombre = datos.nombre.trim();
    if (!nombre) throw new Error("El nombre del contacto es obligatorio.");
    const email = datos.email?.trim() || null;
    if (email && !z.string().email().safeParse(email).success) throw new Error("El email no es válido.");

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("contactos_cliente")
      .update({
        nombre,
        cargo: datos.cargo?.trim() || null,
        email,
        telefono: datos.telefono?.trim() || null,
        recibe_facturas: datos.recibeFacturas,
      })
      .eq("id", contactoId)
      .eq("cliente_id", clienteId)
      .select("id");
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error("No se ha encontrado el contacto.");

    revalidatePath(`/admin/clientes/${clienteId}`);
  },
);

/**
 * Borra un cliente creado por error. Solo si no tiene documentos ni campañas (la base de datos lo
 * impide si los hay); si ya tiene historial, lo correcto es desactivarlo.
 */
export const eliminarCliente = accion(async (clienteId: number) => {
  await exigirAdmin();
  const supabase = await createClient();

  const [{ count: documentos }, { count: campanas }] = await Promise.all([
    supabase.from("documentos").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
    supabase.from("campanas").select("id", { count: "exact", head: true }).eq("cliente_id", clienteId),
  ]);
  if ((documentos ?? 0) > 0 || (campanas ?? 0) > 0) {
    throw new Error("Este cliente tiene documentos o campañas: no se puede eliminar. Desactívalo en su lugar.");
  }

  const { error } = await supabase.from("clientes").delete().eq("id", clienteId);
  if (error) {
    if (error.code === "23503") throw new Error("Este cliente tiene datos asociados: desactívalo en su lugar.");
    throw new Error(error.message);
  }

  revalidatePath("/admin/clientes");
});
