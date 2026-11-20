-- =====================================================================
-- CREATIVA — Publicación Supabase Realtime para documentos y cobros
-- =====================================================================
-- Añade `documentos` y `cobros` a `supabase_realtime` para que el
-- Resumen (KPIs, cobros y vencimientos) se actualice en vivo ante
-- cambios de facturación o cobros. Ambas tablas tienen RLS para admin.

DO $$
DECLARE
  tabla TEXT;
  tablas TEXT[] := ARRAY['documentos', 'cobros'];
BEGIN
  FOREACH tabla IN ARRAY tablas LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tabla
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tabla);
    END IF;
  END LOOP;
END $$;
