-- La página pública del cliente necesita ver DÓNDE se hizo cada foto, no solo la foto.
-- Se añaden latitud y longitud al resultado de obtener_fotos_publicas.
-- Cambiar las columnas devueltas obliga a recrear la función; se mantienen
-- SECURITY DEFINER, la validación del token y el permiso de ejecución para anon.

drop function if exists public.obtener_fotos_publicas(text);

create function public.obtener_fotos_publicas(p_token text)
returns table (
  punto_id integer,
  punto_nombre text,
  tipo tipo_foto,
  url_foto text,
  tomada_en timestamptz,
  latitud numeric,
  longitud numeric
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
    SELECT p.id, p.nombre, f.tipo, f.url_foto, f.tomada_en, f.latitud, f.longitud
    FROM enlaces_cliente e
    JOIN campanas c ON c.id = e.campana_id
    JOIN puntos_campana p ON p.campana_id = c.id
    JOIN fotos_punto f ON f.punto_id = p.id
    WHERE e.token = p_token
      AND e.activo
      AND (e.expira_en IS NULL OR e.expira_en > now())
    ORDER BY f.tomada_en;
$$;

revoke all on function public.obtener_fotos_publicas(text) from public;
grant execute on function public.obtener_fotos_publicas(text) to anon, authenticated;
