"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { obtenerUsuarioActual } from "@/lib/supabase/usuario";
import { accion } from "@/lib/accion";
import { euros } from "@/lib/formato";
import { enSegundoPlano, notificar, notificarAdministradores } from "@/lib/push/notificar";
import {
  BUCKET_TICKETS,
  FORMAS_PAGO_GASTO,
  TIPOS_GASTO,
  TIPOS_IVA,
  aNumero,
  calcularIva,
  type EstadoGasto,
} from "@/lib/gastos";

export type EstadoFormulario = { error?: string };

const esquema = z.object({
  tipo: z.enum(TIPOS_GASTO),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida."),
  concepto: z.string().min(2, "El concepto es obligatorio."),
  categoria_id: z.number().int().nullable(),
  usuario_id: z.string().uuid("Elige el responsable."),
  forma_pago: z.enum(FORMAS_PAGO_GASTO),
  total: z.number({ invalid_type_error: "El importe no es válido." }).positive("El importe debe ser mayor que 0."),
  iva_pct: z.number().nullable(),
  proveedor: z.string().nullable(),
  nif_proveedor: z.string().nullable(),
  numero_factura: z.string().nullable(),
  ticket_path: z.string().nullable(),
  estado: z.enum(["pendiente", "aprobado", "reembolsado"]),
  notas: z.string().nullable(),
});

function leer(fd: FormData) {
  const t = (k: string) => {
    const v = fd.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  return {
    tipo: t("tipo") ?? "menor",
    fecha: t("fecha") ?? "",
    concepto: t("concepto") ?? "",
    categoria_id: aNumero(t("categoria_id")),
    usuario_id: t("usuario_id") ?? "",
    forma_pago: t("forma_pago") ?? "efectivo",
    total: aNumero(t("total")) ?? Number.NaN,
    iva_pct: aNumero(t("iva_pct")),
    proveedor: t("proveedor"),
    nif_proveedor: t("nif_proveedor"),
    numero_factura: t("numero_factura"),
    ticket_path: t("ticket_path"),
    estado: t("estado") ?? "pendiente",
    notas: t("notas"),
  };
}

/** Crea o corrige un gasto. El empleado solo gestiona los suyos y siempre quedan "pendientes". */
export async function guardarGasto(_previo: EstadoFormulario, formData: FormData): Promise<EstadoFormulario> {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return { error: "Tu sesión ha caducado. Vuelve a entrar." };
  const esAdmin = usuario.rol === "admin";

  const idCampo = formData.get("id");
  const id = typeof idCampo === "string" && idCampo ? Number(idCampo) : null;

  const analisis = esquema.safeParse(leer(formData));
  if (!analisis.success) return { error: analisis.error.issues[0]?.message ?? "Revisa los datos del formulario." };
  const d = analisis.data;

  // El empleado solo da de alta y corrige gastos menores (los deducibles con factura los registra
  // la administración). La RLS lo impone también en la base de datos.
  if (!esAdmin && d.tipo !== "menor") return { error: "Desde el móvil solo se registran gastos menores." };

  const responsable = esAdmin ? d.usuario_id : usuario.id;
  const estado: EstadoGasto = esAdmin ? d.estado : "pendiente";

  if (d.ticket_path && !d.ticket_path.startsWith(`${usuario.id}/`) && !d.ticket_path.startsWith(`${responsable}/`)) {
    return { error: "El archivo adjunto no es válido. Vuelve a subirlo." };
  }

  let ivaCampos: { iva_pct: number | null; base_imponible: number | null; cuota_iva: number | null };
  if (d.tipo === "deducible") {
    if (d.iva_pct == null || !(TIPOS_IVA as readonly number[]).includes(d.iva_pct)) {
      return { error: "Elige el tipo de IVA (21 %, 10 %, 4 % o 0 %)." };
    }
    if (!d.proveedor) return { error: "El proveedor es obligatorio en un gasto deducible." };
    if (!d.numero_factura) return { error: "El número de factura es obligatorio en un gasto deducible." };
    const { base, cuota } = calcularIva(d.total, d.iva_pct);
    ivaCampos = { iva_pct: d.iva_pct, base_imponible: base, cuota_iva: cuota };
  } else {
    // El gasto menor no es deducible: no lleva IVA ni datos de proveedor/factura.
    ivaCampos = { iva_pct: null, base_imponible: null, cuota_iva: null };
  }

  if (d.tipo === "deducible" && estado !== "pendiente" && !d.ticket_path) {
    return { error: "Un gasto deducible necesita la factura adjunta para aprobarse." };
  }

  const supabase = await createClient();
  const datos = {
    tipo: d.tipo,
    fecha: d.fecha,
    concepto: d.concepto,
    categoria_id: d.categoria_id,
    usuario_id: responsable,
    forma_pago: d.forma_pago,
    total: d.total,
    ...ivaCampos,
    proveedor: d.tipo === "deducible" ? d.proveedor : null,
    nif_proveedor: d.tipo === "deducible" ? d.nif_proveedor : null,
    numero_factura: d.tipo === "deducible" ? d.numero_factura : null,
    ticket_path: d.ticket_path,
    estado,
    notas: d.notas,
    motivo_rechazo: null,
    aprobado_por: estado === "pendiente" ? null : usuario.id,
    aprobado_en: estado === "pendiente" ? null : new Date().toISOString(),
  };

  let destino: number;
  if (id) {
    const { data: actualizados, error } = await supabase.from("gastos").update(datos).eq("id", id).select("id");
    if (error) return { error: error.message };
    // La RLS no da error si no deja tocar la fila: simplemente no la actualiza.
    if (!actualizados || actualizados.length === 0) {
      return {
        error: esAdmin
          ? "No se ha encontrado el gasto."
          : "Este gasto ya no se puede modificar (solo los pendientes o rechazados que son tuyos).",
      };
    }
    destino = id;
  } else {
    const { data, error } = await supabase
      .from("gastos")
      .insert({ ...datos, creado_por: usuario.id })
      .select("id")
      .single();
    if (error || !data) return { error: error?.message ?? "No se pudo guardar el gasto." };
    destino = data.id;
    // Gasto enviado por un empleado: aviso a la administración (campana + push) con enlace al panel de revisión.
    if (!esAdmin) {
      const quien = [usuario.nombre, usuario.apellidos].filter(Boolean).join(" ");
      enSegundoPlano(() =>
        notificarAdministradores({
          tipo: "gasto_pendiente",
          titulo: `Gasto menor de ${quien}`,
          cuerpo: `${d.concepto} · ${euros(d.total)}${d.ticket_path ? " · con ticket" : " · sin ticket"}`,
          url: `/admin/gastos?revisar=${destino}`,
          tag: `gasto-${destino}`,
        }),
      );
    }
  }

  revalidatePath("/admin/gastos");
  revalidatePath("/admin/contabilidad");
  revalidatePath("/app/gastos");
  redirect(esAdmin ? `/admin/gastos/${destino}` : "/app/gastos");
}

/** Aprobar, rechazar (con motivo) o marcar como reembolsado. Solo admin. */
export const cambiarEstadoGasto = accion(async (id: number, estado: EstadoGasto, motivo?: string) => {
  const admin = await exigirAdmin();
  const supabase = await createClient();

  const { data: gasto, error: errLectura } = await supabase
    .from("gastos")
    .select("tipo, estado, ticket_path, usuario_id, concepto, total")
    .eq("id", id)
    .single();
  if (errLectura || !gasto) throw new Error("No se ha encontrado el gasto.");

  if (estado === "aprobado" && gasto.tipo === "deducible" && !gasto.ticket_path) {
    throw new Error("Falta la factura: adjúntala antes de aprobar un gasto deducible.");
  }
  if (estado === "reembolsado" && gasto.estado !== "aprobado") {
    throw new Error("Solo se puede reembolsar un gasto aprobado.");
  }
  const motivoLimpio = motivo?.trim() ?? "";
  if (estado === "rechazado" && !motivoLimpio) throw new Error("Escribe el motivo del rechazo.");

  const { error } = await supabase
    .from("gastos")
    .update({
      estado,
      motivo_rechazo: estado === "rechazado" ? motivoLimpio : null,
      aprobado_por: estado === "pendiente" ? null : admin.id,
      aprobado_en: estado === "pendiente" ? null : new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  // Se avisa al empleado de la decisión (si el gasto no es del propio admin).
  if (gasto.usuario_id !== admin.id && ["aprobado", "rechazado", "reembolsado"].includes(estado)) {
    const importe = `${gasto.concepto} · ${euros(Number(gasto.total))}`;
    const titulo =
      estado === "aprobado" ? "Gasto aprobado ✓" : estado === "reembolsado" ? "Gasto reembolsado ✓" : "Gasto rechazado";
    const cuerpo = estado === "rechazado" ? `${gasto.concepto}: ${motivoLimpio}` : importe;
    enSegundoPlano(() =>
      notificar([gasto.usuario_id], { tipo: "gasto_decidido", titulo, cuerpo, url: "/app/gastos", tag: `gasto-${id}` }),
    );
  }

  revalidatePath("/admin/gastos");
  revalidatePath(`/admin/gastos/${id}`);
  revalidatePath("/admin/contabilidad");
  revalidatePath("/app/gastos");
});

/** Borra un gasto (y su adjunto). Un gasto ya reembolsado no se borra. */
export const eliminarGasto = accion(async (id: number) => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) throw new Error("Tu sesión ha caducado.");
  const supabase = await createClient();

  const { data: gasto } = await supabase.from("gastos").select("estado, ticket_path").eq("id", id).single();
  if (!gasto) throw new Error("No se ha encontrado el gasto.");
  if (gasto.estado === "reembolsado") throw new Error("Un gasto reembolsado no se puede eliminar.");

  const { error } = await supabase.from("gastos").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (gasto.ticket_path) await supabase.storage.from(BUCKET_TICKETS).remove([gasto.ticket_path]);

  revalidatePath("/admin/gastos");
  revalidatePath("/admin/contabilidad");
  revalidatePath("/app/gastos");
});
