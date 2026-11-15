-- Avisos de la administración al equipo (comunicaciones urgentes).
--
-- Un aviso tiene destinatarios; cada destinatario tiene su propio estado: cuántas veces se le ha enviado,
-- si lo ha abierto y si ha confirmado la lectura. Los avisos urgentes se repiten cada 10 minutos (hasta 3
-- recordatorios) a quien no confirma, y después se avisa a la administración. Las escrituras las hace
-- el servidor (service_role); la administración lo ve todo y cada persona solo lo suyo.

create table if not exists public.avisos (
  id          bigint generated always as identity primary key,
  titulo      text not null,
  cuerpo      text not null,
  -- Urgente = exige confirmar la lectura y se repite hasta que se confirme.
  urgente     boolean not null default true,
  creado_por  uuid references public.usuarios(id) on delete set null,
  creado_en   timestamptz not null default now(),
  -- Cerrar un aviso detiene los recordatorios (p. ej. porque ya se resolvió por teléfono).
  cerrado_en  timestamptz
);

create table if not exists public.avisos_destinatarios (
  aviso_id         bigint not null references public.avisos(id) on delete cascade,
  usuario_id       uuid not null references public.usuarios(id) on delete cascade,
  envios           integer not null default 0,
  ultimo_envio_en  timestamptz,
  leido_en         timestamptz,
  confirmado_en    timestamptz,
  -- Cuándo se avisó a la administración de que esta persona no confirmó tras todos los recordatorios.
  escalado_en      timestamptz,
  primary key (aviso_id, usuario_id)
);

create index if not exists idx_avisos_dest_usuario_pendiente
  on public.avisos_destinatarios (usuario_id) where confirmado_en is null;

alter table public.avisos enable row level security;
alter table public.avisos_destinatarios enable row level security;

create policy avisos_admin_todo on public.avisos
  for all using (public.es_admin()) with check (public.es_admin());

create policy avisos_destinatario_select on public.avisos
  for select using (
    exists (select 1 from public.avisos_destinatarios d where d.aviso_id = avisos.id and d.usuario_id = auth.uid())
  );

create policy avisos_dest_admin_todo on public.avisos_destinatarios
  for all using (public.es_admin()) with check (public.es_admin());

create policy avisos_dest_propio_select on public.avisos_destinatarios
  for select using (usuario_id = auth.uid());

-- Cada minuto se mira si hay algún aviso urgente pendiente de recordar (o de escalar) y solo entonces se
-- llama a la app: así no se hacen llamadas inútiles las 24 horas.
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
    url     := 'https://creativa-snowy.vercel.app/api/cron/recordatorios-avisos',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || coalesce(v_secreto, '')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
end;
$$;

revoke all on function public.llamar_recordatorios_avisos() from public, anon, authenticated;

select cron.schedule('recordatorios-avisos', '* * * * *', $$select public.llamar_recordatorios_avisos()$$);
