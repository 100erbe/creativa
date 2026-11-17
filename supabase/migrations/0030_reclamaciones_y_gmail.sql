-- =====================================================================
-- CREATIVA — Reclamación de facturas impagadas por Gmail
--   1. cuenta_gmail: la cuenta de Gmail conectada (una sola) con su refresh token.
--      RLS activada y SIN políticas: solo la lee el servidor con la service_role key,
--      así el token nunca llega al navegador.
--   2. reclamaciones: registro de cada borrador de reclamación creado en Gmail
--      (cliente, facturas adjuntas, total insoluto y destinatarios). Solo admin.
--   3. Bucket privado «reclamaciones»: los PDF se guardan un momento mientras se
--      preparan, y se borran al crear el borrador. Sin políticas: solo service_role.
-- =====================================================================

-- 1. Cuenta de Gmail conectada
create table cuenta_gmail (
  id              smallint primary key default 1 check (id = 1),
  email           text not null,
  refresh_token   text not null,
  conectada_por   uuid references usuarios(id) on delete set null,
  conectada_en    timestamptz not null default now()
);
alter table cuenta_gmail enable row level security;
revoke all on cuenta_gmail from anon, authenticated;

-- 2. Reclamaciones preparadas
create table reclamaciones (
  id                 bigserial primary key,
  cliente_id         integer not null references clientes(id) on delete cascade,
  creada_por         uuid references usuarios(id) on delete set null default auth.uid(),
  creada_en          timestamptz not null default now(),
  documentos         integer[] not null,
  total_insoluto     numeric(12,2) not null,
  destinatarios      text[] not null default '{}',
  asunto             text not null,
  remitente          text not null,
  gmail_borrador_id  text,
  gmail_mensaje_id   text
);
create index reclamaciones_cliente_idx on reclamaciones (cliente_id, creada_en desc);
alter table reclamaciones enable row level security;
create policy reclamaciones_admin_todo on reclamaciones
  for all to authenticated using (es_admin()) with check (es_admin());

-- 3. Bucket temporal de los PDF
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('reclamaciones', 'reclamaciones', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
