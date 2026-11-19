-- =====================================================================
-- CREATIVA — Publicación Supabase Realtime para actualización en vivo
-- =====================================================================
-- Añade a `supabase_realtime` las tablas operativas vivas para que los
-- cambios entre administración y empleados se reflejen sin recargar.
-- Todas estas tablas ya tienen políticas RLS de SELECT activas.

DO $$
DECLARE
  tabla TEXT;
  tablas TEXT[] := ARRAY[
    'notificaciones',
    'avisos_destinatarios',
    'campanas',
    'puntos_campana',
    'asignaciones_punto',
    'fotos_punto',
    'gastos'
  ];
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
