-- Los empleados pueden subir fotos desde la galería (por si se olvidaron de hacerlas
-- desde la app) y elegir si incluir la ubicación. Para no engañar al cliente hay que
-- saber de dónde sale cada dato:
--   origen_foto       'camara'  → hecha con la cámara desde la app
--                     'galeria' → elegida de la galería del móvil
--   origen_ubicacion  'gps_camara'   → GPS del móvil en el momento de hacer la foto
--                     'exif'         → ubicación guardada dentro de la propia foto (galería)
--                     'gps_al_subir' → GPS del móvil al subirla (la foto pudo hacerse antes)
--                     NULL           → sin ubicación (no se pidió o no estaba disponible)
-- Si no se incluye la ubicación, no se guardan coordenadas.

alter table public.fotos_punto
  add column if not exists origen_foto text not null default 'camara'
    check (origen_foto in ('camara', 'galeria')),
  add column if not exists origen_ubicacion text
    check (origen_ubicacion in ('gps_camara', 'exif', 'gps_al_subir'));

-- Las fotos ya subidas con coordenadas se hicieron con la cámara y el GPS del momento.
update public.fotos_punto
   set origen_ubicacion = 'gps_camara'
 where latitud is not null and longitud is not null and origen_ubicacion is null;

alter table public.fotos_punto
  add constraint fotos_ubicacion_coherente check (
    (latitud is null and longitud is null and origen_ubicacion is null)
    or (latitud between -90 and 90 and longitud between -180 and 180 and origen_ubicacion is not null)
  );

-- La página pública del cliente necesita saber de dónde sale la ubicación de cada foto.
drop function if exists public.obtener_fotos_publicas(text);

create function public.obtener_fotos_publicas(p_token text)
returns table (
  punto_id integer,
  punto_nombre text,
  tipo tipo_foto,
  url_foto text,
  tomada_en timestamptz,
  latitud numeric,
  longitud numeric,
  origen_ubicacion text
)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
    SELECT p.id, p.nombre, f.tipo, f.url_foto, f.tomada_en, f.latitud, f.longitud, f.origen_ubicacion
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
