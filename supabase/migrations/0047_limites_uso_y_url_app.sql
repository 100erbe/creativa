-- =====================================================================
-- CREATIVA — Fase 3 de la auditoría del 25/11/2026 (M-01, M-02).
--   1. Límite de uso por persona/acción (lectura de tickets con IA, push de prueba,
--      emails de recuperación). Solo lo usa el servidor con la clave de servicio.
--   2. La dirección de la app para pg_cron sale del Vault (app_url), no escrita en el código.
--   3. En sus avisos, la persona solo puede marcar «leído» (no cambiar título, enlace…).
--   4. Avatares: subir/cambiar/borrar la foto propia exige cuenta activa.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Límite de uso (ventana fija). RLS sin políticas: solo la clave de servicio.
-- ---------------------------------------------------------------------
create table if not exists public.limites_uso (
  clave     text        not null,
  ventana   timestamptz not null,
  contador  integer     not null default 0,
  primary key (clave, ventana)
);
alter table public.limites_uso enable row level security;
revoke all on public.limites_uso from anon, authenticated;

-- Suma un uso y devuelve true si aún está dentro del límite (p_max usos cada p_segundos).
create or replace function public.consumir_limite(p_clave text, p_max integer, p_segundos integer)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ventana timestamptz := to_timestamp(floor(extract(epoch from now()) / p_segundos) * p_segundos);
  v_contador integer;
begin
  insert into limites_uso as l (clave, ventana, contador)
  values (p_clave, v_ventana, 1)
  on conflict (clave, ventana) do update set contador = l.contador + 1
  returning contador into v_contador;

  -- Limpieza de ventanas viejas de vez en cuando (no hace falta un cron aparte).
  if random() < 0.02 then
    delete from limites_uso where ventana < now() - interval '2 days';
  end if;

  return v_contador <= p_max;
end;
$$;

revoke all on function public.consumir_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------
-- 2. Dirección pública de la app para las llamadas de pg_cron.
--    Se guarda en el Vault como «app_url»; si falta, se usa la de siempre.
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'app_url') then
    perform vault.create_secret('https://creativa-snowy.vercel.app', 'app_url', 'Dirección pública de la app (pg_cron → /api/cron/*)');
  end if;
end;
$$;

create or replace function public.url_app()
returns text
language sql
stable
security definer
set search_path = public, vault, pg_temp
as $$
  select rtrim(coalesce(
    (select decrypted_secret from vault.decrypted_secrets where name = 'app_url' limit 1),
    'https://creativa-snowy.vercel.app'
  ), '/');
$$;

revoke all on function public.url_app() from public, anon, authenticated;

create or replace function public.llamar_resumen_diario()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secreto text;
begin
  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  perform net.http_post(
    url     := public.url_app() || '/api/cron/resumen-diario',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_secreto, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

create or replace function public.llamar_recordatorios_avisos()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secreto text;
begin
  if not exists (
    select 1
      from public.avisos_destinatarios d
      join public.avisos a on a.id = d.aviso_id
     where a.urgente
       and a.cerrado_en is null
       and d.confirmado_en is null
       and d.envios >= 1
       and d.ultimo_envio_en <= now() - interval '10 minutes'
       and (d.envios < 4 or d.escalado_en is null)
  ) then
    return;
  end if;

  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  perform net.http_post(
    url     := public.url_app() || '/api/cron/recordatorios-avisos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_secreto, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

create or replace function public.llamar_cierres_punto()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  v_secreto text;
begin
  if not exists (
    select 1
      from public.asignaciones_punto a
      join public.puntos_campana p on p.id = a.punto_id
     where a.estado = 'completada'
       and a.cierre_notificado_en is null
       and a.fecha_completada is not null
       and a.fecha_completada <= now() - interval '1 minute'
       and a.fecha_completada >= now() - interval '24 hours'
       and p.estado = 'instalado'
  ) then
    return;
  end if;

  select decrypted_secret into v_secreto from vault.decrypted_secrets where name = 'cron_secret' limit 1;
  perform net.http_post(
    url     := public.url_app() || '/api/cron/cierres-punto',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_secreto, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 3. notificaciones: la persona solo cambia leida_en en las suyas.
-- ---------------------------------------------------------------------
create or replace function public.limitar_cambios_notificacion()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is not null and not public.es_admin()
     and (to_jsonb(new) - 'leida_en') is distinct from (to_jsonb(old) - 'leida_en') then
    raise exception 'Solo puedes marcar el aviso como leído.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_limitar_cambios_notificacion on public.notificaciones;
create trigger trg_limitar_cambios_notificacion
  before update on public.notificaciones
  for each row execute function public.limitar_cambios_notificacion();

-- ---------------------------------------------------------------------
-- 4. Avatares: cuenta activa para subir, cambiar o borrar la foto propia.
-- ---------------------------------------------------------------------
drop policy if exists avatares_propios_subir on storage.objects;
create policy avatares_propios_subir on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.es_usuario_activo())
  );

drop policy if exists avatares_propios_actualizar on storage.objects;
create policy avatares_propios_actualizar on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.es_usuario_activo())
  )
  with check (bucket_id = 'avatares' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists avatares_propios_borrar on storage.objects;
create policy avatares_propios_borrar on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatares'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.es_usuario_activo())
  );

drop policy if exists avatares_ver on storage.objects;
create policy avatares_ver on storage.objects
  for select to authenticated
  using (bucket_id = 'avatares' and (select public.es_usuario_activo()));
