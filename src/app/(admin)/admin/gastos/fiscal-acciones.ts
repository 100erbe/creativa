"use server";

import { createClient } from "@/lib/supabase/server";
import { exigirAdmin } from "@/lib/supabase/exigir-admin";
import { accion } from "@/lib/accion";
import { BUCKET_TICKETS } from "@/lib/gastos";

export type ArchivoFactura = { nombre: string; url: string };

const limpiar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);

/**
 * URLs firmadas (10 min) de las facturas y tickets adjuntos de un trimestre. El ZIP se arma
 * en el navegador: una función del servidor no puede devolver más de ~4 MB.
 */
export const firmarFacturasTrimestre = accion(async (ejercicio: number, trimestre: number) => {
  await exigirAdmin();
  if (!Number.isInteger(ejercicio) || ![1, 2, 3, 4].includes(trimestre)) throw new Error("Trimestre no válido.");
  const desde = `${ejercicio}-${String((trimestre - 1) * 3 + 1).padStart(2, "0")}-01`;
  const hasta = new Date(Date.UTC(ejercicio, trimestre * 3, 1)).toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gastos")
    .select("codigo, fecha, proveedor, concepto, numero_factura, ticket_path, estado")
    .gte("fecha", desde)
    .lt("fecha", hasta)
    .neq("estado", "rechazado")
    .not("ticket_path", "is", null)
    .order("fecha")
    .order("id");
  if (error) throw new Error(error.message);
  const filas = data ?? [];
  if (filas.length === 0) return [] as ArchivoFactura[];

  const { data: firmas, error: errFirma } = await supabase.storage
    .from(BUCKET_TICKETS)
    .createSignedUrls(filas.map((g) => g.ticket_path as string), 600);
  if (errFirma) throw new Error(errFirma.message);

  return filas.flatMap((g, i) => {
    const url = firmas?.[i]?.signedUrl;
    if (!url) return [];
    const extension = (g.ticket_path as string).split(".").pop() ?? "pdf";
    const partes = [g.codigo, g.fecha, g.proveedor ?? g.concepto, g.numero_factura].filter(Boolean).map((p) => limpiar(String(p)));
    return [{ nombre: `${partes.join("_")}.${extension}`, url }];
  });
});
