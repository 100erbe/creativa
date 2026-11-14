-- Fotos de los puntos: cada empleado solo ve y puede borrar las que subió él.
-- El admin conserva acceso total (políticas *_admin_todo ya existentes).
-- El bucket exige fotos ya comprimidas desde la app (máx. 512 KB, JPEG/WebP).

update storage.buckets
   set file_size_limit = 524288,
       allowed_mime_types = array['image/jpeg', 'image/webp']
 where id = 'fotos-puntos';

-- Storage: el empleado ve/borra solo los objetos que subió (owner_id = su uid).
drop policy if exists "fotos_puntos_empleado_ver" on storage.objects;

create policy "fotos_puntos_propias_ver" on storage.objects
  for select to authenticated
  using (bucket_id = 'fotos-puntos' and owner_id = (select auth.uid())::text);

create policy "fotos_puntos_propias_borrar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-puntos' and owner_id = (select auth.uid())::text);

-- Tabla fotos_punto: el empleado solo ve y borra sus propias filas.
drop policy if exists "fotos_empleado_select" on public.fotos_punto;

create policy "fotos_empleado_select" on public.fotos_punto
  for select to authenticated
  using (usuario_id = (select auth.uid()));

create policy "fotos_empleado_delete" on public.fotos_punto
  for delete to authenticated
  using (usuario_id = (select auth.uid()));
