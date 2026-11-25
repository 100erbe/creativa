// Libros registro del IVA y del IRPF en el "formato electrónico común" de la AEAT
// (Libro registro unificado, tipo T: pestañas EXPEDIDAS_INGRESOS y RECIBIDAS_GASTOS).
// Diseño: plantilla PLANTILLA_LIBROS_UNIFICADOS.xlsx de la Sede (actualizada 09-09-2026):
// 3 filas de cabecera y los asientos desde la fila 4; importes "1234,56" y fechas "dd/mm/aaaa".
// Se importa en Pre303, en el modelo 130 y en Renta Web. Cada fichero lleva todo el ejercicio
// hasta el final del trimestre (la AEAT no lo admite fraccionado por trimestre).

import { cuotaDeducible } from "@/lib/gastos";
import { esSinFactura, gastoDeducibleIrpf, type GastoFiscal } from "@/lib/fiscal-gastos";
import { redondearCentimos } from "@/lib/redondeo";

type Celda = string | null;

export type Actividad = { codigo: string | null; tipo: string | null; epigrafe: string | null };

export type FacturaEmitida = {
  fecha: string;
  fecha_operacion: string | null;
  tipo: "factura" | "rectificativa";
  /** R1–R5; si falta en una rectificativa, R1. */
  causa_rectificacion?: string | null;
  serie: string | null;
  numero_completo: string | null;
  cliente_documento: string | null;
  cliente_razon_social: string | null;
  cliente_pais: string | null;
  regimen_iva: "general" | "reducido" | "intracomunitario" | "exento";
  motivo_exencion: string | null;
  descuento_global_pct: number | string;
  retencion_pct: number | string;
  total: number | string;
  lineas: { importe: number | string; iva_pct: number | string }[];
};

const num = (v: number | string | null | undefined) => Number(v) || 0;
const r2 = redondearCentimos;

/** 1234.5 → "1234,50" (sin separador de miles, signo "-" delante). */
export const importe = (v: number) => r2(v).toFixed(2).replace(".", ",");
/** "2026-07-04" → "04/07/2026" */
export const fechaAeat = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
const trimestreDe = (iso: string) => `${Math.ceil(Number(iso.slice(5, 7)) / 3)}T`;
const corta = (s: string | null | undefined, max: number) => (s ? s.trim().slice(0, max) : null);

/** "25.703.757-S" → "25703757S". Sin guiones, puntos ni espacios (validación 2 del diseño). */
export const nifLimpio = (nif: string | null | undefined) => (nif ? nif.replace(/[^0-9A-Za-z]/g, "").toUpperCase() : "");
const esNifEspanol = (nif: string) => /^[0-9A-Z]\d{7}[0-9A-Z]$/.test(nif);

function actividad(a: Actividad): Celda[] {
  return [a.codigo, a.codigo === "C" || a.codigo === "D" ? null : a.tipo, a.epigrafe];
}

const CAB_EXPEDIDAS: Celda[][] = [
  ["Autoliquidación", null, "Actividad", null, null, "Tipo de Factura", "Concepto de Ingreso", "Ingreso Computable", "Fecha Expedición", "Fecha Operación", "Identificación de la Factura", null, null, "NIF Destinatario", null, null, "Nombre Destinatario", "Clave de Operación", "Calificación de la Operación", "Operación Exenta", "Total Factura", "Base Imponible", "Tipo de IVA", "Cuota IVA Repercutida", "Tipo de Recargo Eq.", "Cuota Recargo Eq.", "Cobro (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)", null, null, null, "Tipo Retención del IRPF", "Importe Retenido del IRPF", "Registro Acuerdo Facturación", "Inmueble", null, "Referencia Externa"],
  ["Ejercicio", "Periodo", "Código", "Tipo", "Grupo o Epígrafe del IAE", null, null, null, null, null, "Serie", "Número", "Número-Final", "Tipo", "Código País", "Identificación", null, null, null, null, null, null, null, null, null, null, "Fecha", "Importe", "Medio Utilizado", "Identificación Medio Utilizado", null, null, null, "Situación", "Referencia Catastral", null],
  ["Decimal (4,0)", "Alfanumérico (2)", "Alfanumérico (1)", "Alfanumérico (2)", "Alfanumérico (4)", "Alfanumérico (2)", "Alfanumérico (3)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Fecha(dd/mm/yyyy)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (2)", "Alfanumérico (2)", "Alfanumérico (20)", "Alfanumérico (40)", "Alfanumérico (2)", "Alfanumérico (2)", "Alfanumérico (2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Decimal(12,2)", "Alfanumérico (2)", "Alfanumérico (34)", "Decimal(4,2)", "Decimal(12,2)", "Alfanumérico (15)", "Alfanumérico (1)", "Alfanumérico (20)", "Alfanumérico (40)"],
];

const CAB_RECIBIDAS: Celda[][] = [
  ["Autoliquidación", null, "Actividad", null, null, "Tipo de Factura", "Concepto de Gasto", "Gasto Deducible", "Fecha Expedición", "Fecha Operación", "Identificación Factura del Expedidor", null, "Fecha Recepción", "Número Recepción", "Número Recepción Final", "NIF Expedidor", null, null, "Nombre Expedidor", "Clave de Operación", "Bien de Inversión", "Inversión del Sujeto Pasivo", "Deducible en Periodo Posterior", "Periodo Deducción", null, "Total Factura", "Base Imponible", "Tipo de IVA", "Cuota IVA Soportado", "Cuota Deducible", "Tipo de Recargo Eq.", "Cuota Recargo Eq.", "Pago (Operación Criterio de Caja de IVA y/o artículo 7.2.1º de Reglamento del IRPF)", null, null, null, "Tipo Retención del IRPF", "Importe Retenido del IRPF", "Registro Acuerdo Facturación", "Inmueble", null, "Referencia Externa"],
  ["Ejercicio", "Periodo", "Código", "Tipo", "Grupo o Epígrafe del IAE", null, null, null, null, null, "(Serie-Número)", "Número-Final", null, null, null, "Tipo", "Código País", "Identificación", null, null, null, null, null, "Ejercicio", "Periodo", null, null, null, null, null, null, null, "Fecha", "Importe", "Medio Utilizado", "Identificación Medio Utilizado", null, null, null, "Situación", "Referencia Catastral", null],
  ["Decimal (4,0)", "Alfanumérico (2)", "Alfanumérico (1)", "Alfanumérico (2)", "Alfanumérico (4)", "Alfanumérico (2)", "Alfanumérico (3)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Fecha(dd/mm/yyyy)", "Alfanumérico (40)", "Alfanumérico (20)", "Fecha(dd/mm/yyyy)", "Alfanumérico (20)", "Alfanumérico (20)", "Alfanumérico (2)", "Alfanumérico (2)", "Alfanumérico (20)", "Alfanumérico (40)", "Alfanumérico (2)", "Alfanumérico (1)", "Alfanumérico (1)", "Alfanumérico (1)", "Decimal (4,0)", "Alfanumérico (2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Decimal(12,2)", "Decimal(4,2)", "Decimal(12,2)", "Fecha(dd/mm/yyyy)", "Decimal(12,2)", "Alfanumérico (2)", "Alfanumérico (34)", "Decimal(4,2)", "Decimal(12,2)", "Alfanumérico (15)", "Alfanumérico (1)", "Alfanumérico (20)", "Alfanumérico (40)"],
];

/** Causa de exención a partir del texto del motivo (art. 20, 21, 22, 23/24, 25); "E6" si no se reconoce. */
function causaExencion(motivo: string | null, regimen: FacturaEmitida["regimen_iva"]) {
  if (regimen === "intracomunitario") return "E5";
  const m = motivo?.match(/art(?:[íi]culo|\.)?\s*(\d{2})/i)?.[1];
  return ({ "20": "E1", "21": "E2", "22": "E3", "23": "E4", "24": "E4", "25": "E5" } as Record<string, string>)[m ?? ""] ?? "E6";
}

/** Asientos de facturas emitidas: una fila por tipo de IVA de cada factura. */
export function filasExpedidas(facturas: FacturaEmitida[], act: Actividad): Celda[][] {
  const filas: Celda[][] = [];
  for (const f of facturas) {
    const descuento = num(f.descuento_global_pct) / 100;
    const exenta = f.regimen_iva === "exento" || f.regimen_iva === "intracomunitario";
    const porTipo = new Map<number, number>();
    for (const l of f.lineas) porTipo.set(num(l.iva_pct), (porTipo.get(num(l.iva_pct)) ?? 0) + num(l.importe) * (1 - descuento));
    if (porTipo.size === 0) porTipo.set(0, 0);

    const nif = nifLimpio(f.cliente_documento);
    const extranjero = !!f.cliente_pais && f.cliente_pais.toUpperCase() !== "ES";
    const tipoFactura = f.tipo === "rectificativa" ? (f.causa_rectificacion ?? "R1") : nif ? "F1" : "F2";
    for (const [pct, baseBruta] of porTipo) {
      const base = r2(baseBruta);
      const cuota = exenta ? 0 : r2((base * pct) / 100);
      filas.push([
        f.fecha.slice(0, 4),
        trimestreDe(f.fecha),
        ...actividad(act),
        tipoFactura,
        "I01",
        importe(base),
        fechaAeat(f.fecha),
        f.fecha_operacion && f.fecha_operacion !== f.fecha ? fechaAeat(f.fecha_operacion) : null,
        corta(f.serie, 20),
        corta(f.numero_completo, 20),
        null,
        extranjero && nif ? "02" : null,
        extranjero && nif ? f.cliente_pais!.toUpperCase().slice(0, 2) : null,
        nif || null,
        corta(f.cliente_razon_social, 40),
        "01",
        exenta ? null : "S1",
        exenta ? causaExencion(f.motivo_exencion, f.regimen_iva) : null,
        importe(num(f.total)),
        importe(base),
        exenta ? null : importe(pct),
        exenta ? null : importe(cuota),
        null,
        null,
        null,
        null,
        null,
        null,
        num(f.retencion_pct) > 0 ? importe(num(f.retencion_pct)) : null,
        num(f.retencion_pct) > 0 ? importe((base * num(f.retencion_pct)) / 100) : null,
      ]);
    }
  }
  return filas;
}

/** Asientos de facturas recibidas y gastos (solo deducibles aprobados o reembolsados). */
export function filasRecibidas(gastos: GastoFiscal[], act: Actividad): Celda[][] {
  return gastos.map((g, i) => {
    const sinFactura = esSinFactura(g);
    const nif = nifLimpio(g.nif_proveedor);
    const total = num(g.total);
    const base = num(g.base_imponible);
    const cuota = num(g.cuota_iva);
    const deducibleIrpf = gastoDeducibleIrpf(g);
    const conRetencion = num(g.importe_retencion) > 0;
    const numero = String(i + 1);
    return [
      g.fecha.slice(0, 4),
      trimestreDe(g.fecha),
      ...actividad(act),
      sinFactura ? "SF" : nif ? "F1" : "F2",
      g.bien_inversion ? null : g.concepto_aeat,
      g.bien_inversion ? null : importe(deducibleIrpf),
      fechaAeat(g.fecha),
      null,
      sinFactura ? null : corta(g.numero_factura, 40),
      null,
      fechaAeat(g.fecha),
      numero,
      null,
      !sinFactura && nif && !esNifEspanol(nif) ? "02" : null,
      !sinFactura && nif && !esNifEspanol(nif) && /^[A-Z]{2}/.test(nif) ? nif.slice(0, 2) : null,
      sinFactura ? null : nif || null,
      corta(g.proveedor, 40),
      sinFactura ? null : "01",
      sinFactura ? null : g.bien_inversion ? "S" : "N",
      sinFactura ? null : "N",
      sinFactura ? null : "N",
      null,
      null,
      importe(total),
      sinFactura ? null : importe(base),
      sinFactura ? null : importe(num(g.iva_pct)),
      sinFactura ? null : importe(cuota),
      sinFactura ? null : importe(cuotaDeducible(cuota, num(g.pct_deducible_iva))),
      null,
      null,
      null,
      null,
      null,
      null,
      conRetencion ? importe(num(g.retencion_pct)) : null,
      conRetencion ? importe(num(g.importe_retencion)) : null,
    ];
  });
}

export const hojasLibroAeat = (expedidas: Celda[][], recibidas: Celda[][]) => [
  { nombre: "EXPEDIDAS_INGRESOS", filas: [...CAB_EXPEDIDAS, ...expedidas], anchos: Array(36).fill(14) },
  { nombre: "RECIBIDAS_GASTOS", filas: [...CAB_RECIBIDAS, ...recibidas], anchos: Array(42).fill(14) },
];
