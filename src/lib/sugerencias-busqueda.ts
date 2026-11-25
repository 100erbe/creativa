// Sugerencias para los buscadores del área de administración (autocompletar).
// Se ejecutan en el navegador con el cliente de Supabase: la RLS limita los datos al usuario.

import { createClient } from "@/lib/supabase/client";
import type { Sugerencia } from "@/components/ui/autocompletar";
import { ETIQUETA_ESTADO_DOC, ETIQUETA_TIPO } from "@/lib/documentos";
import { ETIQUETA_ESTADO_GASTO, type EstadoGasto } from "@/lib/gastos";
import { euros, fechaCorta } from "@/lib/formato";

const LIMITE = 3;

/** Quita los caracteres que rompen la sintaxis de .or() de PostgREST (igual que las páginas). */
function limpiar(q: string) {
  return q.replace(/[,()%*\\]/g, " ").trim();
}

const unir = (partes: (string | null | undefined | false)[]) => partes.filter(Boolean).join(" · ");

/** Clientes por nombre, nombre comercial, NIF, código o ciudad → ficha del cliente. */
export async function sugerirClientes(texto: string, incluirInactivos = false): Promise<Sugerencia[]> {
  const q = limpiar(texto);
  if (!q) return [];
  let consulta = createClient()
    .from("clientes")
    .select("id, codigo, razon_social, nombre_comercial, numero_documento, municipio, activo")
    .or(
      ["razon_social", "nombre_comercial", "numero_documento", "codigo", "municipio"]
        .map((c) => `${c}.ilike.%${q}%`)
        .join(","),
    )
    .order("razon_social")
    .limit(LIMITE);
  if (!incluirInactivos) consulta = consulta.eq("activo", true);
  const { data } = await consulta;
  return (data ?? []).map((c) => ({
    id: `cliente-${c.id}`,
    titulo: c.razon_social,
    detalle: unir([
      c.nombre_comercial && c.nombre_comercial !== c.razon_social ? c.nombre_comercial : null,
      c.numero_documento,
      c.municipio,
    ]),
    insignia: c.activo ? undefined : "Inactivo",
    href: `/admin/clientes/${c.id}`,
  }));
}

type FilaDocumento = {
  id: number;
  tipo: string;
  estado: string;
  numero_completo: string | null;
  fecha: string;
  total: number | null;
  cliente_razon_social: string | null;
  clientes: { razon_social: string } | { razon_social: string }[] | null;
};

function aSugerenciaDocumento(d: FilaDocumento): Sugerencia {
  const cli = Array.isArray(d.clientes) ? d.clientes[0] : d.clientes;
  const cliente = d.cliente_razon_social ?? cli?.razon_social ?? null;
  return {
    id: `doc-${d.id}`,
    titulo: unir([d.numero_completo ?? "Borrador", cliente]),
    detalle: unir([
      ETIQUETA_ESTADO_DOC[d.estado] ?? d.estado,
      fechaCorta(d.fecha),
      d.total != null ? euros(Number(d.total)) : null,
    ]),
    insignia: ETIQUETA_TIPO[d.tipo] ?? d.tipo,
    href: `/admin/documentos/${d.id}`,
  };
}

const COLUMNAS_DOC =
  "id, tipo, estado, numero_completo, fecha, total, cliente_razon_social, clientes(razon_social)" as const;

/** Documentos por número o cliente (como la lista de /admin/documentos) → ficha del documento. */
export async function sugerirDocumentos(texto: string): Promise<Sugerencia[]> {
  const q = limpiar(texto);
  if (!q) return [];
  const supabase = createClient();
  // Los borradores no tienen el nombre del cliente copiado: se busca también en la tabla clientes.
  const { data: clientes } = await supabase
    .from("clientes")
    .select("id")
    .or(`razon_social.ilike.%${q}%,nombre_comercial.ilike.%${q}%`)
    .limit(200);
  const ids = (clientes ?? []).map((c) => c.id);
  const condiciones = [`numero_completo.ilike.%${q}%`, `cliente_razon_social.ilike.%${q}%`];
  if (ids.length) condiciones.push(`cliente_id.in.(${ids.join(",")})`);
  const { data } = await supabase
    .from("documentos")
    .select(COLUMNAS_DOC)
    .or(condiciones.join(","))
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMITE);
  return (data ?? []).map(aSugerenciaDocumento);
}

/** Facturas emitidas del libro registro por número, cliente o NIF → ficha del documento. */
export async function sugerirLibroRegistro(texto: string, ejercicio: number): Promise<Sugerencia[]> {
  const q = limpiar(texto);
  if (!q) return [];
  const { data } = await createClient()
    .from("documentos")
    .select(COLUMNAS_DOC)
    .in("tipo", ["factura", "rectificativa"])
    .neq("estado", "borrador")
    .gte("fecha", `${ejercicio}-01-01`)
    .lte("fecha", `${ejercicio}-12-31`)
    .or(
      ["numero_completo", "cliente_razon_social", "cliente_documento", "descripcion"]
        .map((c) => `${c}.ilike.%${q}%`)
        .join(","),
    )
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMITE);
  return (data ?? []).map(aSugerenciaDocumento);
}

/** Gastos del ejercicio por concepto, proveedor, código o n.º de factura → ficha del gasto. */
export async function sugerirGastos(texto: string, ejercicio: number): Promise<Sugerencia[]> {
  const q = limpiar(texto);
  if (!q) return [];
  const { data } = await createClient()
    .from("gastos")
    .select("id, codigo, concepto, proveedor, numero_factura, total, fecha, estado")
    .gte("fecha", `${ejercicio}-01-01`)
    .lte("fecha", `${ejercicio}-12-31`)
    .or(["concepto", "proveedor", "numero_factura", "codigo"].map((c) => `${c}.ilike.%${q}%`).join(","))
    .order("fecha", { ascending: false })
    .order("id", { ascending: false })
    .limit(LIMITE);
  return (data ?? []).map((g) => ({
    id: `gasto-${g.id}`,
    titulo: unir([g.codigo, g.concepto]),
    detalle: unir([g.proveedor, fechaCorta(g.fecha), g.total != null ? euros(Number(g.total)) : null]),
    insignia: ETIQUETA_ESTADO_GASTO[g.estado as EstadoGasto] ?? g.estado,
    href: `/admin/gastos/${g.id}`,
  }));
}
