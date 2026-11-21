-- Permite que un elemento de la campaña sea un punto exacto, una zona con radio (metros)
-- o una zona delimitada por un polígono GeoJSON (distrito/barrio de OpenStreetMap).

alter table public.puntos_campana
  add column if not exists tipo_ubicacion text not null default 'punto'
    check (tipo_ubicacion in ('punto', 'radio', 'poligono')),
  add column if not exists radio_metros integer
    check (radio_metros is null or (radio_metros >= 50 and radio_metros <= 25000)),
  add column if not exists geometria jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'puntos_ubicacion_coherente'
  ) then
    alter table public.puntos_campana
      add constraint puntos_ubicacion_coherente check (
        (tipo_ubicacion = 'punto' and radio_metros is null and geometria is null)
        or (tipo_ubicacion = 'radio' and radio_metros is not null and geometria is null)
        or (tipo_ubicacion = 'poligono' and radio_metros is null and geometria is not null)
      );
  end if;
end $$;

-- La vista de agenda del empleado expone también la geometría de zona (conservando security_invoker).
create or replace view public.v_agenda_empleado
with (security_invoker = true) as
  select u.id as usuario_id,
         u.nombre as empleado,
         a.id as asignacion_id,
         a.rol_asignacion,
         a.estado as estado_asignacion,
         a.fecha_programada,
         c.id as campana_id,
         c.nombre as campana,
         p.id as punto_id,
         p.nombre as punto,
         p.direccion,
         p.latitud,
         p.longitud,
         p.tipo_soporte,
         p.estado as estado_punto,
         p.tipo_ubicacion,
         p.radio_metros,
         p.geometria
  from public.asignaciones_punto a
  join public.usuarios u on u.id = a.usuario_id
  join public.puntos_campana p on p.id = a.punto_id
  join public.campanas c on c.id = p.campana_id;

-- Versión pública con información de zona (punto / radio / polígono).
create or replace function public.obtener_campana_publica_v2(p_token text)
returns table (
  campana_nombre text,
  campana_estado estado_campana,
  cliente_nombre text,
  fecha_inicio date,
  fecha_fin date,
  punto_id integer,
  punto_nombre text,
  tipo_soporte tipo_soporte,
  direccion text,
  latitud numeric,
  longitud numeric,
  punto_estado estado_punto,
  tipo_ubicacion text,
  radio_metros integer,
  geometria jsonb
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
    SELECT c.nombre, c.estado, cl.razon_social,
           c.fecha_inicio, c.fecha_fin,
           p.id, p.nombre, p.tipo_soporte, p.direccion,
           p.latitud, p.longitud, p.estado,
           p.tipo_ubicacion, p.radio_metros, p.geometria
    FROM enlaces_cliente e
    JOIN campanas c ON c.id = e.campana_id
    JOIN clientes cl ON cl.id = c.cliente_id
    LEFT JOIN puntos_campana p ON p.campana_id = c.id
    WHERE e.token = p_token
      AND e.activo
      AND (e.expira_en IS NULL OR e.expira_en > now());
$$;

revoke all on function public.obtener_campana_publica_v2(text) from public;
grant execute on function public.obtener_campana_publica_v2(text) to anon, authenticated;
