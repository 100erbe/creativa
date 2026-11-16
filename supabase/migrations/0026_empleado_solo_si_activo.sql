-- =====================================================================
-- CREATIVA — Una cuenta desactivada no escribe nada desde la app del miembro,
-- aunque conserve un token válido hasta que caduque. Solo restringe permisos.
-- (es_admin() ya exigía `activo`; aquí se aplica lo mismo al resto de escrituras.)
-- =====================================================================

drop policy if exists puntos_empleado_update_estado on puntos_campana;
create policy puntos_empleado_update_estado on puntos_campana
  for update
  using (
    (select es_usuario_activo())
    and exists (select 1 from asignaciones_punto a where a.punto_id = puntos_campana.id and a.usuario_id = auth.uid())
  )
  with check (
    exists (select 1 from asignaciones_punto a where a.punto_id = puntos_campana.id and a.usuario_id = auth.uid())
  );

drop policy if exists asignaciones_empleado_update on asignaciones_punto;
create policy asignaciones_empleado_update on asignaciones_punto
  for update
  using (usuario_id = auth.uid() and (select es_usuario_activo()))
  with check (usuario_id = auth.uid());

drop policy if exists fotos_empleado_insert on fotos_punto;
create policy fotos_empleado_insert on fotos_punto
  for insert
  with check (
    usuario_id = auth.uid()
    and (select es_usuario_activo())
    and exists (select 1 from asignaciones_punto a where a.punto_id = fotos_punto.punto_id and a.usuario_id = auth.uid())
  );

drop policy if exists fotos_puntos_empleado_subir on storage.objects;
create policy fotos_puntos_empleado_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'fotos-puntos'
    and (select public.es_usuario_activo())
    and exists (
      select 1 from public.asignaciones_punto a
       where a.usuario_id = auth.uid() and ('punto_' || a.punto_id) = (storage.foldername(objects.name))[1]
    )
  );
