-- Resumen diario del trabajo de mañana.
--
-- 1. Una fila por persona y periodo resumido: su restricción única impide mandar dos veces el mismo resumen,
--    aunque el cron se ejecute dos veces (lo hace a propósito, por el cambio de hora).
-- 2. pg_cron llama a la app con pg_net a las 18:00 y a las 19:00 UTC de lunes a viernes. La app solo envía
--    cuando en Madrid son las 20:00 (18:00 UTC en verano, 19:00 UTC en invierno).
-- 3. El secreto con el que se identifica el cron vive en Supabase Vault (secreto "cron_secret"), que se crea
--    aparte: no debe estar en un archivo de migración que se sube a git.

create table if not exists public.resumenes_enviados (
  id             bigint generated always as identity primary key,
  usuario_id     uuid not null references public.usuarios(id) on delete cascade,
  fecha_objetivo date not null,
  puntos         integer not null,
  enviado_en     timestamptz not null default now(),
  unique (usuario_id, fecha_objetivo)
);

alter table public.resumenes_enviados enable row level security;
-- Sin políticas: solo el servidor (service_role) escribe y lee esta tabla.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Llamada a la app. Si el secreto no existe todavía, la app responde 401 y no pasa nada.
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
    url     := 'https://creativa-snowy.vercel.app/api/cron/resumen-diario',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_secreto, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.llamar_resumen_diario() from public, anon, authenticated;

select cron.schedule('resumen-diario-18utc', '0 18 * * 1-5', $$select public.llamar_resumen_diario()$$);
select cron.schedule('resumen-diario-19utc', '0 19 * * 1-5', $$select public.llamar_resumen_diario()$$);
