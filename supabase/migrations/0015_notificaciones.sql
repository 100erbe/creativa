-- Bandeja de avisos: cada aviso que se envía por push se guarda también aquí.
--
-- Así, si el push no llega (móvil apagado, sin cobertura, avisos desactivados), la persona ve lo mismo
-- al abrir la app, con un contador de no leídos. Las filas las crea el servidor (service_role); cada
-- persona solo lee las suyas y las marca como leídas.

create table if not exists public.notificaciones (
  id          bigint generated always as identity primary key,
  usuario_id  uuid not null references public.usuarios(id) on delete cascade,
  tipo        text not null,
  titulo      text not null,
  cuerpo      text not null,
  url         text,
  creada_en   timestamptz not null default now(),
  leida_en    timestamptz
);

create index if not exists idx_notificaciones_usuario
  on public.notificaciones (usuario_id, creada_en desc);

alter table public.notificaciones enable row level security;

create policy notificaciones_propias_select on public.notificaciones
  for select using (usuario_id = auth.uid());

create policy notificaciones_propias_update on public.notificaciones
  for update using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
