-- =====================================================================
-- 0031 · Fotos de perfil (avatares)
-- Bucket privado «avatares»: cada persona sube su foto en la carpeta
-- con su id ({uid}/avatar-<marca>.webp) y todo el equipo autenticado
-- puede verlas (se sirven con URL firmada). usuarios.avatar_url guarda
-- la ruta dentro del bucket; ya se puede cambiar en la fila propia
-- (proteger_campos_usuario solo protege rol, activo, email e id).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatares', 'avatares', false, 307200, array['image/jpeg', 'image/webp'])
on conflict (id) do nothing;

-- Ver: cualquier cuenta autenticada (el avatar aparece en listas del equipo).
create policy avatares_ver on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares');

-- Subir, reemplazar y borrar: solo en la carpeta propia.
create policy avatares_propios_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatares_propios_actualizar on storage.objects
  for update to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy avatares_propios_borrar on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);
