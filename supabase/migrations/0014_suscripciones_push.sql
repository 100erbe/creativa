-- Notificaciones push (Web Push): un dispositivo = una suscripción.
--
-- El navegador del móvil entrega un "endpoint" (URL del servicio push de Google/Apple/Mozilla) y dos
-- claves (p256dh y auth) con las que el servidor cifra cada aviso. Los tres datos permiten enviar avisos a
-- ese dispositivo, así que solo el servidor (service_role) los usa para enviar; las personas ven y borran
-- únicamente los suyos.

create table if not exists public.suscripciones_push (
  id               bigint generated always as identity primary key,
  usuario_id       uuid not null references public.usuarios(id) on delete cascade,
  endpoint         text not null unique,
  p256dh           text not null,
  auth             text not null,
  user_agent       text,
  creada_en        timestamptz not null default now(),
  actualizada_en   timestamptz not null default now(),
  -- Último envío aceptado por el servicio push y fallos seguidos desde entonces (para detectar
  -- dispositivos muertos y para que el administrador vea si una persona está "alcanzable").
  ultimo_envio_ok  timestamptz,
  fallos_seguidos  integer not null default 0
);

create index if not exists idx_suscripciones_push_usuario on public.suscripciones_push (usuario_id);

alter table public.suscripciones_push enable row level security;

-- Cada persona ve y elimina sus dispositivos. Las altas y los cambios los hace el servidor
-- (service_role, que se salta la RLS) tras comprobar la sesión: un mismo móvil puede cambiar de
-- persona y eso exige reasignar la fila, algo que la RLS de la propia persona no permitiría.
create policy suscripciones_push_propias_select on public.suscripciones_push
  for select using (usuario_id = auth.uid());

create policy suscripciones_push_propias_delete on public.suscripciones_push
  for delete using (usuario_id = auth.uid());

-- La administración ve el estado de todo el equipo (cuántos dispositivos, último envío correcto).
create policy suscripciones_push_admin_select on public.suscripciones_push
  for select using (public.es_admin());
