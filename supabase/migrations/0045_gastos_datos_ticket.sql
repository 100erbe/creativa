-- =====================================================================
-- CREATIVA — Datos leídos del ticket por la IA (Gemini)
-- Al escanear un ticket se guarda lo que la IA ha leído (proveedor, NIF,
-- nº, fecha, importes, IVA…). Es solo una ayuda para la administración:
-- p. ej. avisar de que un "gasto menor" es en realidad una factura
-- simplificada con IVA deducible. Nunca sustituye a los datos del gasto.
-- =====================================================================

alter table gastos add column datos_ticket jsonb;

comment on column gastos.datos_ticket is
  'Lectura automática del ticket (IA): proveedor, NIF, nº, fecha, importes, IVA y campos dudosos. Solo orientativo para la revisión.';
