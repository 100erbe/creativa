-- 1. La incidencia de un punto tiene su propio campo.
--    Antes, al reportar una incidencia el empleado escribía en `notas`, que es donde el
--    administrador deja las instrucciones de instalación ("Cómo instalar"): se perdían.
alter table public.puntos_campana
  add column if not exists incidencia    text,
  add column if not exists incidencia_en timestamptz;

comment on column public.puntos_campana.notas is
  'Instrucciones de instalación escritas por el administrador.';
comment on column public.puntos_campana.incidencia is
  'Texto de la última incidencia reportada por el empleado.';

-- Las incidencias ya reportadas guardaron su texto en `notas` (pisando las instrucciones):
-- se mueve al campo nuevo. Las instrucciones originales ya no se pueden recuperar.
update public.puntos_campana
   set incidencia    = notas,
       incidencia_en = coalesce(incidencia_en, now()),
       notas         = null
 where estado = 'incidencia'
   and incidencia is null
   and notas is not null;

-- 2. Una campaña con algún punto asignado ya está en curso (la app solo creaba campañas
--    "planificada" y nunca las avanzaba, así que el panel no mostraba ninguna activa).
update public.campanas c
   set estado = 'en_curso'
 where c.estado = 'planificada'
   and exists (
     select 1
       from public.puntos_campana p
       join public.asignaciones_punto a on a.punto_id = p.id
      where p.campana_id = c.id
   );
