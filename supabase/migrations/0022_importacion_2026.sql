-- Importación zFAC 2026: trazabilidad Excel/PDF, serie con prefijos FAC/AB/PTO/ALB/REC
-- (ya aplicada en Supabase "Creativa - App"; el catálogo, clientes y documentos se cargaron con funciones temporales)
alter table documentos
  add column if not exists sin_pdf boolean not null default false,
  add column if not exists revisar boolean not null default false,
  add column if not exists motivo_revision text,
  add column if not exists origen_datos text,
  add column if not exists archivo_origen text,
  add column if not exists drive_file_id text,
  add column if not exists datos_excel jsonb;
create index if not exists idx_documentos_revisar on documentos (revisar) where revisar;
create index if not exists idx_documentos_sin_pdf on documentos (sin_pdf) where sin_pdf;

alter table cobros add column if not exists fecha_estimada boolean not null default false;
alter table clientes
  add column if not exists alias text[] not null default '{}',
  add column if not exists revisar boolean not null default false;
alter table productos add column if not exists alias text[] not null default '{}';
alter table lineas_documento add column if not exists revisar boolean not null default false;

create table if not exists pdfs_sin_asignar (
  id serial primary key,
  archivo text not null,
  drive_file_id text,
  tipo text,
  numero int,
  base numeric(12,2),
  total numeric(12,2),
  motivo text,
  creado_en timestamptz not null default now()
);
alter table pdfs_sin_asignar enable row level security;
create policy pdfs_sin_asignar_admin_todo on pdfs_sin_asignar for all using (es_admin()) with check (es_admin());

update series set prefijo='FAC-', sufijo_anual=true, digitos=4 where codigo='F';
update series set prefijo='AB-',  sufijo_anual=true, digitos=3 where codigo='AB';
update series set prefijo='PTO-', sufijo_anual=true, digitos=4 where codigo='P';
update series set prefijo='ALB-', sufijo_anual=true, digitos=4 where codigo='ALB';
update series set prefijo='REC-', sufijo_anual=true, digitos=4 where codigo='REC';
