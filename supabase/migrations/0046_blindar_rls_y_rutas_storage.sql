-- =====================================================================
-- CREATIVA — Correcciones críticas de la auditoría del 25/11/2026.
-- Solo endurece permisos y valida rutas: no modifica ningún dato existente
-- (comprobado antes de aplicar: todas las rutas actuales cumplen los CHECK).
--   C-01. El miembro solo cambia el estado de su asignación (no el punto, ni el rol…).
--   C-02. Con la verificación en dos pasos activada, sin código (aal1) no hay permisos.
--   C-03. Rutas de tickets válidas (sin «..») y, para el miembro, en su propia carpeta.
--   C-04. La foto de un punto solo puede apuntar a la carpeta de ese punto.
-- =====================================================================

-- ---------------------------------------------------------------------
-- C-02. Verificación en dos pasos también en la base de datos.
-- Quien tiene un factor verificado necesita una sesión aal2; quien no lo tiene, entra igual.
-- ---------------------------------------------------------------------
create or replace function public.mfa_cumplido()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = auth.uid() and f.status = 'verified'
      );
$$;

revoke all on function public.mfa_cumplido() from public, anon;
grant execute on function public.mfa_cumplido() to authenticated, service_role;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from usuarios
     where id = auth.uid() and rol = 'admin' and activo
  ) and public.mfa_cumplido();
$$;

create or replace function public.es_usuario_activo()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from usuarios where id = auth.uid() and activo)
     and public.mfa_cumplido();
$$;

-- ---------------------------------------------------------------------
-- C-01. asignaciones_punto: el miembro solo toca estado, fecha_completada y
-- cierre_notificado_en (este último solo a null o a «ahora»).
-- ---------------------------------------------------------------------
create or replace function public.limitar_cambios_asignacion_empleado()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_libres text[] := array['estado', 'fecha_completada', 'cierre_notificado_en'];
begin
  -- auth.uid() nulo = clave de servicio o SQL del panel: sin restricción.
  if auth.uid() is not null and not public.es_admin() then
    if (to_jsonb(new) - v_libres) is distinct from (to_jsonb(old) - v_libres) then
      raise exception 'Solo puedes cambiar el estado de tu tarea.';
    end if;
    if new.cierre_notificado_en is distinct from old.cierre_notificado_en
       and new.cierre_notificado_en is not null
       and abs(extract(epoch from (new.cierre_notificado_en - now()))) > 300 then
      raise exception 'Fecha de aviso de cierre no válida.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_cambios_asignacion_empleado on public.asignaciones_punto;
create trigger trg_limitar_cambios_asignacion_empleado
  before update on public.asignaciones_punto
  for each row execute function public.limitar_cambios_asignacion_empleado();

-- ---------------------------------------------------------------------
-- C-03. Tickets: formato de ruta «<uuid>/<archivo>.<ext>» sin saltos de carpeta.
-- ---------------------------------------------------------------------
alter table public.gastos drop constraint if exists gastos_ticket_path_valido;
alter table public.gastos add constraint gastos_ticket_path_valido check (
  ticket_path is null
  or ticket_path ~ '^[0-9a-f-]{36}/[A-Za-z0-9_-][A-Za-z0-9._-]*\.(webp|jpg|jpeg|png|pdf)$'
);

-- El miembro solo adjunta tickets de su propia carpeta.
drop policy if exists gastos_empleado_crear on public.gastos;
create policy gastos_empleado_crear on public.gastos
  for insert to authenticated
  with check (
    usuario_id = (select auth.uid()) and creado_por = (select auth.uid())
    and estado = 'pendiente' and tipo = 'menor'
    and (ticket_path is null or split_part(ticket_path, '/', 1) = (select auth.uid())::text)
    and (select es_usuario_activo())
  );

drop policy if exists gastos_empleado_corregir on public.gastos;
create policy gastos_empleado_corregir on public.gastos
  for update to authenticated
  using (usuario_id = (select auth.uid()) and estado in ('pendiente', 'rechazado') and (select es_usuario_activo()))
  with check (
    usuario_id = (select auth.uid()) and estado = 'pendiente' and tipo = 'menor'
    and (ticket_path is null or split_part(ticket_path, '/', 1) = (select auth.uid())::text)
  );

-- El miembro borra sus propios tickets solo si ya no los usa ningún gasto
-- (al eliminar un gasto pendiente, o un archivo subido y descartado).
drop policy if exists tickets_gastos_propios_borrar on storage.objects;
create policy tickets_gastos_propios_borrar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'tickets-gastos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and owner_id = (select auth.uid())::text
    and (select public.es_usuario_activo())
    and not exists (select 1 from public.gastos g where g.ticket_path = objects.name)
  );

-- ---------------------------------------------------------------------
-- C-04. Fotos: la ruta debe estar en la carpeta del propio punto.
-- ---------------------------------------------------------------------
alter table public.fotos_punto drop constraint if exists fotos_punto_url_valida;
alter table public.fotos_punto add constraint fotos_punto_url_valida check (
  url_foto ~ ('^punto_' || punto_id::text || '/[A-Za-z0-9_-][A-Za-z0-9._-]*\.(webp|jpg)$')
);
