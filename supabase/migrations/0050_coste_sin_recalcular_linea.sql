-- =====================================================================
-- CREATIVA — Margen bruto (27/11/2026)
-- Cambiar SOLO el coste interno de una línea no debe recalcular cantidad ni importe.
-- Sin esto, en facturas importadas (importe original distinto del recálculo) calcular_linea
-- cambiaba el importe y proteger_lineas bloqueaba la corrección del coste.
-- =====================================================================

create or replace function public.calcular_linea()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'coste_unitario') = (to_jsonb(OLD) - 'coste_unitario') THEN
    RETURN NEW;
  END IF;
  IF NEW.unidad IN ('m2','ml') AND NEW.ancho_cm IS NOT NULL THEN
    NEW.cantidad := cantidad_facturable(NEW.unidad, NEW.piezas, NEW.ancho_cm, NEW.alto_cm, NEW.minimo_por_pieza);
  ELSE
    NEW.cantidad := NEW.piezas;
  END IF;
  NEW.importe := round(NEW.cantidad * (NEW.precio_unitario + NEW.recargo_acabados)
                       * (1 - NEW.descuento_pct / 100), 2);
  RETURN NEW;
END $function$;
