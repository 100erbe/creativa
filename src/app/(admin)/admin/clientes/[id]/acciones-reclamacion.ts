"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";
import { crearBorrador } from "@/lib/gmail";
import { construirMensaje, type Adjunto } from "@/lib/mime";
import { cargarEstadoCuenta, nombreArchivoEstadoCuenta, nombreArchivoFactura } from "@/lib/estado-cuenta-datos";
import { BUCKET_RECLAMACIONES, LOTE_VALIDO, emailValido, rutaAdjunto } from "@/lib/reclamacion";

/**
 * Crea en Gmail el borrador de reclamación con el estado de cuenta y las facturas vencidas
 * (ya preparados en el lote) y lo deja anotado en el historial del cliente.
 */
export const crearBorradorReclamacion = accion(
  async (
    clienteId: number,
    lote: string,
    datos: { para: string[]; asunto: string; cuerpo: string; documentos: number[] },
  ) => {
    await exigirAdmin();
    if (!LOTE_VALIDO.test(lote)) throw new Error("Lote no válido.");
    const para = [...new Set(datos.para.map((e) => e.trim().toLowerCase()).filter(Boolean))];
    if (para.length === 0) throw new Error("Pon al menos un destinatario.");
    const malos = para.filter((e) => !emailValido(e));
    if (malos.length) throw new Error(`Dirección de email no válida: ${malos.join(", ")}`);
    const asunto = datos.asunto.trim();
    if (!asunto) throw new Error("Pon un asunto.");

    const supabase = await createClient();
    const estadoCuenta = await cargarEstadoCuenta(supabase, clienteId);
    if (!estadoCuenta) throw new Error("El cliente no existe.");
    const { estado, cliente } = estadoCuenta;
    if (estado.insolutas.length === 0) throw new Error("Este cliente no tiene facturas vencidas.");

    // Si entre preparar y crear el borrador ha cambiado algo (un cobro nuevo), se vuelve a preparar.
    const actuales = estado.insolutas.map((l) => l.id).sort((a, b) => a - b).join(",");
    const preparadas = [...datos.documentos].sort((a, b) => a - b).join(",");
    if (actuales !== preparadas) {
      throw new Error("Las facturas vencidas han cambiado mientras se preparaba. Cierra y vuelve a preparar la reclamación.");
    }

    const admin = crearClienteAdmin();
    if (!admin) throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.");
    const almacen = admin.storage.from(BUCKET_RECLAMACIONES);

    const archivos: { archivo: "estado" | number; nombre: string }[] = [
      { archivo: "estado", nombre: nombreArchivoEstadoCuenta(cliente.razonSocial, estado.fecha) },
      ...estado.insolutas.map((l) => ({ archivo: l.id, nombre: nombreArchivoFactura(l.tipo, l.numero, cliente.razonSocial) })),
    ];
    const adjuntos: Adjunto[] = [];
    for (const a of archivos) {
      const { data, error } = await almacen.download(rutaAdjunto(clienteId, lote, a.archivo));
      if (error || !data) throw new Error(`Falta el PDF «${a.nombre}». Vuelve a preparar la reclamación.`);
      adjuntos.push({ nombre: `${a.nombre}.pdf`, tipo: "application/pdf", contenido: new Uint8Array(await data.arrayBuffer()) });
    }

    const borrador = await crearBorrador(construirMensaje({ para, asunto, cuerpo: datos.cuerpo, adjuntos }));

    const { error } = await supabase.from("reclamaciones").insert({
      cliente_id: clienteId,
      documentos: estado.insolutas.map((l) => l.id),
      total_insoluto: estado.totalAReclamar,
      destinatarios: para,
      asunto,
      remitente: borrador.remitente,
      gmail_borrador_id: borrador.borradorId,
      gmail_mensaje_id: borrador.mensajeId,
    });
    if (error) console.error("Reclamación · historial:", error.message);

    // Fuera los PDF de este lote y los de preparaciones anteriores que se quedaron a medias.
    const { data: lotes } = await almacen.list(String(clienteId));
    const sobrantes = await Promise.all(
      (lotes ?? []).map(async (l) => {
        const { data } = await almacen.list(`${clienteId}/${l.name}`);
        return (data ?? []).map((f) => `${clienteId}/${l.name}/${f.name}`);
      }),
    );
    const borrar = sobrantes.flat();
    if (borrar.length) await almacen.remove(borrar);
    revalidatePath(`/admin/clientes/${clienteId}`);
    return { url: borrador.url, remitente: borrador.remitente };
  },
);
