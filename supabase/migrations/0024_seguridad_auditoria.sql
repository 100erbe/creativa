-- =====================================================================
-- CREATIVA — Correcciones de seguridad de la auditoría (16/11/2026).
-- Solo endurece permisos: no toca ningún dato existente.
--   1. Nadie puede cambiarse a sí mismo el rol, el estado (activo) ni el email.
--   2. El miembro solo cambia en sus puntos el estado y la incidencia.
--   3. Sin fila activa en `usuarios` no se sube nada a tickets ni se crean gastos;
--      el miembro solo registra/corrige gastos menores.
--   4. Cierre de sesiones de una persona desactivada (solo con la clave de servicio).
--   5. Fuera las funciones de la importación (imp_cargar_*).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Persona activa (tenga el rol que tenga). SECURITY DEFINER como es_admin():
-- se usa dentro de políticas y no debe depender de la RLS de `usuarios`.
-- ---------------------------------------------------------------------
create or replace function es_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from usuarios where id = auth.uid() and activo);
$$;

revoke all on function es_usuario_activo() from public, anon;
grant execute on function es_usuario_activo() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 1. usuarios: rol, activo y email solo los cambia un admin activo (o la clave de servicio).
--    La política y el trigger se cubren mutuamente.
-- ---------------------------------------------------------------------
drop policy if exists usuarios_propio_update on usuarios;
create policy usuarios_propio_update on usuarios
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and rol    = (select u.rol    from usuarios u where u.id = auth.uid())
    and activo = (select u.activo from usuarios u where u.id = auth.uid())
    and email  = (select u.email  from usuarios u where u.id = auth.uid())
  );

create or replace function proteger_campos_usuario()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  -- auth.uid() nulo = clave de servicio o SQL del panel: sin restricción.
  if auth.uid() is not null and not public.es_admin()
     and (new.rol, new.activo, new.email, new.id) is distinct from (old.rol, old.activo, old.email, old.id) then
    raise exception 'Solo una persona administradora puede cambiar el rol, el estado o el email de una cuenta.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_proteger_campos_usuario on usuarios;
create trigger trg_proteger_campos_usuario
  before update on usuarios
  for each row execute function proteger_campos_usuario();

-- ---------------------------------------------------------------------
-- 2. puntos_campana: el miembro solo toca estado e incidencia (lo que usa su app).
-- ---------------------------------------------------------------------
create or replace function limitar_cambios_punto_empleado()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_libres text[] := array['estado', 'incidencia', 'incidencia_en', 'actualizado_en'];
begin
  if auth.uid() is not null and not public.es_admin()
     and (to_jsonb(new) - v_libres) is distinct from (to_jsonb(old) - v_libres) then
    raise exception 'Solo puedes cambiar el estado del punto o avisar de una incidencia.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_cambios_punto_empleado on puntos_campana;
create trigger trg_limitar_cambios_punto_empleado
  before update on puntos_campana
  for each row execute function limitar_cambios_punto_empleado();

-- ---------------------------------------------------------------------
-- 3. Tickets y gastos del miembro: cuenta activa; el miembro solo gestiona gastos menores.
-- ---------------------------------------------------------------------
drop policy if exists tickets_gastos_propios_subir on storage.objects;
create policy tickets_gastos_propios_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'tickets-gastos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.es_usuario_activo())
  );

drop policy if exists gastos_empleado_crear on gastos;
create policy gastos_empleado_crear on gastos
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid()) and creado_por = (select auth.uid())
    and estado = 'pendiente' and tipo = 'menor'
    and (select es_usuario_activo())
  );

drop policy if exists gastos_empleado_corregir on gastos;
create policy gastos_empleado_corregir on gastos
  for update to authenticated
  using (usuario_id = (select auth.uid()) and estado in ('pendiente', 'rechazado') and (select es_usuario_activo()))
  with check (usuario_id = (select auth.uid()) and estado = 'pendiente' and tipo = 'menor');

-- ---------------------------------------------------------------------
-- 4. Cerrar todas las sesiones de una persona (al desactivarla). Solo clave de servicio.
-- ---------------------------------------------------------------------
create or replace function cerrar_sesiones_usuario(p_usuario uuid)
returns void
language sql
security definer
set search_path = auth, pg_temp
as $$
  delete from auth.sessions where user_id = p_usuario;
$$;

revoke all on function cerrar_sesiones_usuario(uuid) from public, anon, authenticated;
grant execute on function cerrar_sesiones_usuario(uuid) to service_role;

-- ---------------------------------------------------------------------
-- 5. Restos de la importación 2026: ya no se usan.
-- ---------------------------------------------------------------------
drop function if exists imp_cargar_catalogo(jsonb);
drop function if exists imp_cargar_clientes(jsonb);
drop function if exists imp_cargar_documentos(jsonb);
