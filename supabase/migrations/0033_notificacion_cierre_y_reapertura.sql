-- =====================================================================
-- CREATIVA — Notificación diferida (1 min) de punto instalado y aviso
--            inmediato si un punto ya notificado vuelve a no instalado.
-- =====================================================================

ALTER TABLE public.asignaciones_punto
  ADD COLUMN IF NOT EXISTS cierre_notificado_en TIMESTAMPTZ;

-- No notificar retrospectivamente cierres anteriores a esta migración.
UPDATE public.asignaciones_punto
   SET cierre_notificado_en = COALESCE(fecha_completada, now())
 WHERE estado = 'completada'
   AND cierre_notificado_en IS NULL;

CREATE INDEX IF NOT EXISTS idx_asignaciones_cierre_pendiente
  ON public.asignaciones_punto (fecha_completada)
  WHERE estado = 'completada' AND cierre_notificado_en IS NULL;

-- Llama a la app solo si hay cierres pendientes de notificar tras >= 1 minuto.
CREATE OR REPLACE FUNCTION public.llamar_cierres_punto()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_secreto TEXT;
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM public.asignaciones_punto a
      JOIN public.puntos_campana p ON p.id = a.punto_id
     WHERE a.estado = 'completada'
       AND a.cierre_notificado_en IS NULL
       AND a.fecha_completada IS NOT NULL
       AND a.fecha_completada <= now() - interval '1 minute'
       AND a.fecha_completada >= now() - interval '24 hours'
       AND p.estado = 'instalado'
  ) THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_secreto FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
  PERFORM net.http_post(
    url     := 'https://creativa-snowy.vercel.app/api/cron/cierres-punto',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || COALESCE(v_secreto, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
END;
$$;

REVOKE ALL ON FUNCTION public.llamar_cierres_punto() FROM public, anon, authenticated;

SELECT cron.schedule('cierres-punto', '* * * * *', $$SELECT public.llamar_cierres_punto()$$);
