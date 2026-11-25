import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { esquemaDatosTicket, type LecturaTicket, type SugerenciaGasto } from "@/lib/datos-ticket";
import { BUCKET_TICKETS, rutaTicketConFormato } from "@/lib/gastos";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

/**
 * Lectura de tickets y facturas con Gemini (API de Google AI Studio).
 * La clave GEMINI_API_KEY solo existe en el servidor. Sin clave, la lectura falla y el formulario
 * se rellena a mano como siempre.
 */
export const MODELO_TICKET = "gemini-3.5-flash-lite";
const TIEMPO_MAX_MS = 20_000;

const ESQUEMA_RESPUESTA = {
  type: "OBJECT",
  properties: {
    tipo_documento: { type: "STRING", enum: ["factura_simplificada", "factura_completa", "otro"] },
    proveedor: { type: "STRING", nullable: true, description: "Razón social del emisor" },
    nif_proveedor: { type: "STRING", nullable: true, description: "NIF/CIF del emisor tal cual aparece, sin espacios" },
    numero_factura: { type: "STRING", nullable: true, description: "Nº de factura o ticket, si aparece" },
    fecha: { type: "STRING", nullable: true, description: "Fecha del ticket en formato YYYY-MM-DD" },
    total: { type: "NUMBER", nullable: true, description: "Importe total pagado, IVA incluido" },
    iva_pct: { type: "NUMBER", nullable: true },
    base_imponible: { type: "NUMBER", nullable: true },
    cuota_iva: { type: "NUMBER", nullable: true },
    forma_pago: { type: "STRING", enum: ["efectivo", "tarjeta", "desconocido"] },
    concepto: { type: "STRING", description: "Descripción breve del gasto en español (p. ej. 'Peaje autopista', 'Comida', 'Gasolina')" },
    categoria: { type: "STRING", nullable: true, description: "Una de las categorías dadas, escrita igual; null si ninguna encaja" },
    campos_dudosos: { type: "ARRAY", items: { type: "STRING" }, description: "Nombres de los campos que no se leen con seguridad" },
  },
  required: ["tipo_documento", "proveedor", "nif_proveedor", "fecha", "total", "iva_pct", "forma_pago", "concepto", "categoria", "campos_dudosos"],
};

function instrucciones(categorias: string[]) {
  return `Extrae los datos de este ticket o factura española de un gasto de empresa.
Copia NIF, fecha e importes exactamente como aparecen; no inventes nada: si un dato no se lee con claridad, déjalo null y añade el nombre del campo a campos_dudosos.
Si el IVA viene "incluido", calcula base y cuota a partir del total (redondeo a 2 decimales).
Categorías posibles: ${categorias.length ? categorias.join(", ") : "(ninguna)"}.
Si la imagen no es un ticket ni una factura, usa tipo_documento "otro" y deja los importes en null.`;
}

export async function leerTicketConIa(
  archivo: Blob,
  categorias: string[],
): Promise<LecturaTicket> {
  const clave = process.env.GEMINI_API_KEY;
  if (!clave) throw new Error("La lectura automática no está configurada.");

  const datos = Buffer.from(await archivo.arrayBuffer()).toString("base64");
  const respuesta = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELO_TICKET}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": clave },
      signal: AbortSignal.timeout(TIEMPO_MAX_MS),
      body: JSON.stringify({
        contents: [{ parts: [{ inline_data: { mime_type: archivo.type, data: datos } }, { text: instrucciones(categorias) }] }],
        generationConfig: { responseMimeType: "application/json", responseSchema: ESQUEMA_RESPUESTA, temperature: 0 },
      }),
    },
  );
  if (!respuesta.ok) {
    // 429 (cuota gratuita agotada) o 503 (servicio saturado): se puede reintentar más tarde.
    throw new Error(`Gemini respondió ${respuesta.status}`);
  }
  const json = (await respuesta.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const texto = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const analisis = esquemaDatosTicket.safeParse(JSON.parse(texto || "null"));
  if (!analisis.success) throw new Error("La lectura del ticket no tiene el formato esperado.");
  return { ...analisis.data, modelo: MODELO_TICKET, leido_en: new Date().toISOString() };
}

type Cliente = SupabaseClient<Database>;

const TIPO_POR_EXTENSION: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  pdf: "application/pdf",
};

/** Descarga el ticket del bucket y lo lee. Con el cliente del usuario la RLS limita a sus propios tickets. */
export async function leerTicketGuardado(supabase: Cliente, ruta: string) {
  const [descarga, categorias] = await Promise.all([
    supabase.storage.from(BUCKET_TICKETS).download(ruta),
    supabase.from("categorias_gasto").select("id, nombre").eq("activo", true),
  ]);
  if (descarga.error || !descarga.data) throw new Error("No se ha encontrado el ticket.");
  const tipo = TIPO_POR_EXTENSION[ruta.split(".").pop()?.toLowerCase() ?? ""];
  if (!tipo) throw new Error("Formato de ticket no admitido.");
  const archivo = new Blob([await descarga.data.arrayBuffer()], { type: tipo });
  const lista = categorias.data ?? [];
  const lectura = await leerTicketConIa(archivo, lista.map((c) => c.nombre));
  return { lectura, categorias: lista };
}

/** Lectura → valores para el formulario. Solo se proponen datos plausibles; el resto se deja vacío. */
export function aSugerencia(
  lectura: LecturaTicket,
  categorias: { id: number; nombre: string }[],
  hoy: string,
): SugerenciaGasto {
  const normalizar = (t: string) => t.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
  const categoria = lectura.categoria
    ? categorias.find((c) => normalizar(c.nombre) === normalizar(lectura.categoria ?? ""))
    : undefined;
  return {
    lectura,
    concepto: lectura.concepto.trim() || null,
    // Una fecha futura es un error de lectura seguro.
    fecha: lectura.fecha && lectura.fecha <= hoy ? lectura.fecha : null,
    total: lectura.total && lectura.total > 0 ? Math.round(lectura.total * 100) / 100 : null,
    forma_pago: lectura.forma_pago === "efectivo" ? "efectivo" : lectura.forma_pago === "tarjeta" ? "tarjeta_empresa" : null,
    categoria_id: categoria?.id ?? null,
  };
}

/**
 * Para gastos guardados sin lectura (sin cobertura al escanear, Gemini saturado…): se lee el ticket
 * después de responder y se guarda en `datos_ticket`, para que la administración vea igualmente la
 * sugerencia. Si falla no pasa nada: el gasto ya está guardado.
 */
export async function completarLecturaTicket(gastoId: number, ruta: string) {
  // Con la clave de servicio se lee cualquier archivo: solo rutas con formato válido (sin «..»).
  if (!rutaTicketConFormato(ruta)) return;
  const admin = crearClienteAdmin();
  if (!admin || !process.env.GEMINI_API_KEY) return;
  try {
    const { lectura } = await leerTicketGuardado(admin, ruta);
    await admin
      .from("gastos")
      .update({ datos_ticket: lectura })
      .eq("id", gastoId)
      .eq("ticket_path", ruta)
      .is("datos_ticket", null);
  } catch (e) {
    console.warn(`[ticket-ia] No se pudo leer el ticket del gasto ${gastoId}:`, e instanceof Error ? e.message : e);
  }
}
