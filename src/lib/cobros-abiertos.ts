import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/**
 * Consultas de cobros compartidas por el layout del admin (contador de 90+ días de la barra)
 * y las páginas de Panel, Cobros y Documentos. Con React.cache() se hacen una sola vez por
 * petición aunque las pidan el layout y la página a la vez.
 */

/** Documentos con cobro abierto (pendiente, parcial o vencido) de v_estado_cobro. */
export const cargarCobrosAbiertos = cache(async () => {
  const supabase = await createClient();
  return supabase
    .from("v_estado_cobro")
    .select("id, tipo, numero_completo, cliente_id, cliente_razon_social, fecha, fecha_vencimiento, total, pendiente, estado_cobro")
    .in("estado_cobro", ["pendiente", "parcial", "vencida"])
    .limit(5000);
});

/** Estado y factura de origen de facturas y rectificativas emitidas (para descontar abonos y anulados). */
export const cargarMetaDocumentosCobro = cache(async () => {
  const supabase = await createClient();
  return supabase
    .from("documentos")
    .select("id, estado, documento_origen_id")
    .in("tipo", ["factura", "rectificativa"])
    .neq("estado", "borrador")
    .limit(5000);
});
