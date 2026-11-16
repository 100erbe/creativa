-- =====================================================================
-- CREATIVA — Gastos: deducibles (con IVA, proveedor y factura) y gastos
-- menores (no deducibles, modelo "Plantilla_Gastos_Menores_Original-v11").
-- Flujo: pendiente → aprobado → reembolsado (o rechazado con motivo).
-- =====================================================================

create type tipo_gasto as enum ('deducible', 'menor');
create type estado_gasto as enum ('pendiente', 'aprobado', 'reembolsado', 'rechazado');
create type forma_pago_gasto as enum ('efectivo', 'tarjeta_empresa', 'caja_chica', 'transferencia');

create table categorias_gasto (
  id      integer generated always as identity primary key,
  nombre  text not null unique,
  activo  boolean not null default true
);

insert into categorias_gasto (nombre) values
  ('Transporte'), ('Comida'), ('Autopista'), ('Ferretería'), ('Varios');

create sequence gastos_codigo_seq;

create table gastos (
  id               bigint generated always as identity primary key,
  codigo           text not null unique default ('GAS-' || lpad(nextval('gastos_codigo_seq')::text, 4, '0')),
  tipo             tipo_gasto not null,
  fecha            date not null default current_date,
  concepto         text not null check (length(btrim(concepto)) > 0),
  categoria_id     integer references categorias_gasto(id),
  usuario_id       uuid not null references usuarios(id),
  forma_pago       forma_pago_gasto not null,
  total            numeric(12,2) not null check (total > 0),
  iva_pct          numeric(4,1),
  base_imponible   numeric(12,2),
  cuota_iva        numeric(12,2),
  proveedor        text,
  nif_proveedor    text,
  numero_factura   text,
  ticket_path      text,
  estado           estado_gasto not null default 'pendiente',
  notas            text,
  motivo_rechazo   text,
  creado_por       uuid references usuarios(id),
  aprobado_por     uuid references usuarios(id),
  aprobado_en      timestamptz,
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),

  -- El menor no lleva IVA; el deducible exige IVA, proveedor y n.º de factura.
  constraint gasto_menor_sin_iva check (
    tipo <> 'menor' or (iva_pct is null and base_imponible is null and cuota_iva is null)
  ),
  constraint gasto_deducible_completo check (
    tipo <> 'deducible' or (
      iva_pct is not null and base_imponible is not null and cuota_iva is not null
      and proveedor is not null and btrim(proveedor) <> ''
      and numero_factura is not null and btrim(numero_factura) <> ''
      and abs(total - base_imponible - cuota_iva) <= 0.01
    )
  ),
  constraint gasto_rechazo_motivado check (estado <> 'rechazado' or coalesce(btrim(motivo_rechazo), '') <> '')
);

create index idx_gastos_fecha on gastos (fecha);
create index idx_gastos_usuario on gastos (usuario_id);
create index idx_gastos_estado on gastos (estado);

create trigger trg_gastos_actualizado
  before update on gastos
  for each row execute function tocar_actualizado();

-- IVA soportado: solo gastos deducibles ya aprobados o reembolsados.
create view v_gastos_iva_trimestral with (security_invoker = on) as
select extract(year from fecha)::int    as ejercicio,
       extract(quarter from fecha)::int as trimestre,
       iva_pct,
       sum(base_imponible)              as base_imponible,
       sum(cuota_iva)                   as cuota_iva,
       count(*)                         as n_gastos
  from gastos
 where tipo = 'deducible' and estado in ('aprobado', 'reembolsado')
 group by 1, 2, 3;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table categorias_gasto enable row level security;
create policy categorias_gasto_admin_todo on categorias_gasto
  for all using (es_admin()) with check (es_admin());
create policy categorias_gasto_ver on categorias_gasto
  for select to authenticated using (activo);

alter table gastos enable row level security;
create policy gastos_admin_todo on gastos
  for all using (es_admin()) with check (es_admin());
create policy gastos_empleado_ver on gastos
  for select to authenticated using (usuario_id = (select auth.uid()));
create policy gastos_empleado_crear on gastos
  for insert to authenticated
  with check (usuario_id = (select auth.uid()) and creado_por = (select auth.uid()) and estado = 'pendiente');
create policy gastos_empleado_corregir on gastos
  for update to authenticated
  using (usuario_id = (select auth.uid()) and estado in ('pendiente', 'rechazado'))
  with check (usuario_id = (select auth.uid()) and estado = 'pendiente');
create policy gastos_empleado_borrar on gastos
  for delete to authenticated
  using (usuario_id = (select auth.uid()) and estado = 'pendiente');

-- ---------------------------------------------------------------------
-- Storage: tickets y facturas (privado; carpeta = id del usuario)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets-gastos', 'tickets-gastos', false, 2097152,
        array['image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;

create policy tickets_gastos_admin_todo on storage.objects
  for all to authenticated
  using (bucket_id = 'tickets-gastos' and es_admin())
  with check (bucket_id = 'tickets-gastos' and es_admin());

create policy tickets_gastos_propios_subir on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tickets-gastos' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy tickets_gastos_propios_ver on storage.objects
  for select to authenticated
  using (bucket_id = 'tickets-gastos' and owner_id = (select auth.uid())::text);
