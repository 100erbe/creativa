-- =====================================================================
-- CREATIVA — Una cuenta desactivada tampoco LEE sus datos desde la app del miembro,
-- aunque conserve un token válido hasta que caduque (0026 ya cerraba las escrituras).
-- Solo restringe permisos: se añade (select es_usuario_activo()) a la condición USING de
-- las políticas propias del miembro, conservando el resto de condiciones, roles y
-- WITH CHECK tal cual (ALTER POLICY ... USING no toca lo demás).
-- No se toca usuarios_propio_select: el middleware y obtenerUsuarioActual leen la propia
-- fila para reconocer la cuenta inactiva. Las políticas de administración ya exigen
-- `activo` a través de es_admin().
-- =====================================================================

-- Lectura -------------------------------------------------------------

alter policy asignaciones_empleado_select on asignaciones_punto
  using (usuario_id = auth.uid() and (select es_usuario_activo()));

alter policy puntos_empleado_select on puntos_campana
  using (
    (select es_usuario_activo())
    and exists (select 1 from asignaciones_punto a where a.punto_id = puntos_campana.id and a.usuario_id = auth.uid())
  );

alter policy campanas_empleado_select on campanas
  using (
    (select es_usuario_activo())
    and exists (
      select 1 from puntos_campana p join asignaciones_punto a on a.punto_id = p.id
       where p.campana_id = campanas.id and a.usuario_id = auth.uid()
    )
  );

alter policy fotos_empleado_select on fotos_punto
  using (usuario_id = (select auth.uid()) and (select es_usuario_activo()));

alter policy gastos_empleado_ver on gastos
  using (usuario_id = (select auth.uid()) and (select es_usuario_activo()));

alter policy avisos_destinatario_select on avisos
  using (
    (select es_usuario_activo())
    and exists (select 1 from avisos_destinatarios d where d.aviso_id = avisos.id and d.usuario_id = auth.uid())
  );

alter policy avisos_dest_propio_select on avisos_destinatarios
  using (usuario_id = auth.uid() and (select es_usuario_activo()));

alter policy notificaciones_propias_select on notificaciones
  using (usuario_id = auth.uid() and (select es_usuario_activo()));

alter policy suscripciones_push_propias_select on suscripciones_push
  using (usuario_id = auth.uid() and (select es_usuario_activo()));

alter policy categorias_gasto_ver on categorias_gasto
  using (activo and (select es_usuario_activo()));

alter policy fotos_puntos_propias_ver on storage.objects
  using (
    bucket_id = 'fotos-puntos'
    and owner_id = (select auth.uid())::text
    and (select public.es_usuario_activo())
  );

alter policy tickets_gastos_propios_ver on storage.objects
  using (
    bucket_id = 'tickets-gastos'
    and owner_id = (select auth.uid())::text
    and (select public.es_usuario_activo())
  );

-- Borrado y marcado ---------------------------------------------------

alter policy fotos_empleado_delete on fotos_punto
  using (usuario_id = (select auth.uid()) and (select es_usuario_activo()));

alter policy gastos_empleado_borrar on gastos
  using (usuario_id = (select auth.uid()) and estado = 'pendiente' and (select es_usuario_activo()));

alter policy notificaciones_propias_update on notificaciones
  using (usuario_id = auth.uid() and (select es_usuario_activo()));

alter policy suscripciones_push_propias_delete on suscripciones_push
  using (usuario_id = auth.uid() and (select es_usuario_activo()));

alter policy fotos_puntos_propias_borrar on storage.objects
  using (
    bucket_id = 'fotos-puntos'
    and owner_id = (select auth.uid())::text
    and (select public.es_usuario_activo())
  );
