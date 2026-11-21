-- Permite al empleado ver en gris (solo lectura / contexto) los demás puntos y zonas
-- de las campañas en las que tiene tareas activas, sin abrir permisos RLS sobre puntos_campana
-- ni exponer notas, fotos ni otras campañas.

create or replace function public.obtener_otros_puntos_campanas_empleado()
returns table (
  punto_id integer,
  campana_id integer,
  campana text,
  punto text,
  direccion text,
  latitud numeric,
  longitud numeric,
  tipo_ubicacion text,
  radio_metros integer,
  geometria jsonb
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select
    p.id as punto_id,
    c.id as campana_id,
    c.nombre as campana,
    p.nombre as punto,
    p.direccion,
    p.latitud,
    p.longitud,
    p.tipo_ubicacion,
    p.radio_metros,
    p.geometria
  from public.puntos_campana p
  join public.campanas c on c.id = p.campana_id
  where public.es_usuario_activo()
    and auth.uid() is not null
    and exists (
      select 1
      from public.asignaciones_punto a
      join public.puntos_campana pm on pm.id = a.punto_id
      where a.usuario_id = auth.uid()
        and a.estado in ('pendiente', 'en_curso')
        and pm.campana_id = p.campana_id
    )
    and not exists (
      select 1
      from public.asignaciones_punto a2
      where a2.punto_id = p.id
        and a2.usuario_id = auth.uid()
        and a2.estado in ('pendiente', 'en_curso')
    )
  order by c.id, p.id;
$$;

revoke all on function public.obtener_otros_puntos_campanas_empleado() from public, anon;
grant execute on function public.obtener_otros_puntos_campanas_empleado() to authenticated, service_role;
