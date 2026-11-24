import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { nombreArchivo } from "@/lib/documento-impresion";

/**
 * Nombre del PDF de un documento leído de la base de datos (sin extensión). Lo usan el título de la
 * pantalla de impresión (lo que propone «Guardar como PDF») y la descarga del PDF.
 * `conSello`: se pidió el sello «PAGADA»; solo se añade si la factura está cobrada por completo.
 */
export async function nombreArchivoDocumento(
  supabase: SupabaseClient<Database>,
  documentoId: number,
  conSello = false,
): Promise<string | null> {
  const { data } = await supabase
    .from("documentos")
    .select("tipo, numero_completo, cliente_razon_social, campana, descripcion, clientes(razon_social, nombre_comercial)")
    .eq("id", documentoId)
    .maybeSingle();
  if (!data) return null;

  const cliente = Array.isArray(data.clientes) ? data.clientes[0] : data.clientes;
  const pagada =
    conSello &&
    data.tipo === "factura" &&
    (await supabase.from("v_estado_cobro").select("estado_cobro").eq("id", documentoId).maybeSingle()).data
      ?.estado_cobro === "cobrada";

  return nombreArchivo({
    tipo: data.tipo,
    numero: data.numero_completo,
    razonSocial: data.cliente_razon_social ?? cliente?.razon_social ?? "",
    nombreComercial: cliente?.nombre_comercial,
    campana: data.campana,
    descripcion: data.descripcion,
    pagada,
  });
}
