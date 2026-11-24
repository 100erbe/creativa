import { z } from "zod";
import type { FormaPagoGasto } from "@/lib/gastos";

/**
 * Lo que la IA lee de un ticket o factura. Se usa para precompilar el formulario y se guarda en
 * `gastos.datos_ticket` como ayuda para la revisión (nunca sustituye a los datos del gasto).
 */
export const esquemaDatosTicket = z.object({
  tipo_documento: z.enum(["factura_simplificada", "factura_completa", "otro"]),
  proveedor: z.string().max(200).nullable(),
  nif_proveedor: z.string().max(20).nullable(),
  numero_factura: z.string().max(60).nullable(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  total: z.number().nonnegative().nullable(),
  iva_pct: z.number().min(0).max(100).nullable(),
  base_imponible: z.number().nullable(),
  cuota_iva: z.number().nullable(),
  forma_pago: z.enum(["efectivo", "tarjeta", "desconocido"]),
  concepto: z.string().max(200),
  categoria: z.string().max(100).nullable(),
  campos_dudosos: z.array(z.string().max(40)).max(20),
});

export type DatosTicket = z.infer<typeof esquemaDatosTicket>;

/** Lo que se guarda en la BD: la lectura más de qué modelo y cuándo. */
export type LecturaTicket = DatosTicket & { modelo: string; leido_en: string };

/** Lectura ya preparada para el formulario (categoría resuelta a su id). */
export type SugerenciaGasto = {
  lectura: LecturaTicket;
  concepto: string | null;
  fecha: string | null;
  total: number | null;
  forma_pago: FormaPagoGasto | null;
  categoria_id: number | null;
};

/** Valida el JSON que llega del formulario; si no es válido se descarta (es solo orientativo). */
export function leerLecturaTicket(valor: unknown): LecturaTicket | null {
  let datos = valor;
  if (typeof valor === "string") {
    try {
      datos = JSON.parse(valor);
    } catch {
      return null;
    }
  }
  const r = esquemaDatosTicket
    .extend({ modelo: z.string().max(60), leido_en: z.string().max(40) })
    .safeParse(datos);
  return r.success ? r.data : null;
}

/**
 * ¿El ticket parece una factura con IVA deducible? Factura (simplificada o completa) con NIF del
 * emisor y un tipo de IVA distinto de 0: la administración puede convertir el gasto menor en deducible.
 */
export function pareceDeducible(l: LecturaTicket | null): boolean {
  return (
    !!l &&
    l.tipo_documento !== "otro" &&
    !!l.nif_proveedor &&
    l.iva_pct != null &&
    l.iva_pct > 0 &&
    (l.total ?? 0) > 0
  );
}
