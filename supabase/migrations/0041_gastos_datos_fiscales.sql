-- =====================================================================
-- CREATIVA — Datos fiscales de los gastos para la lectura por trimestre
-- (303, 130, 111) y el libro registro de facturas recibidas en el formato
-- electrónico común de la AEAT (pestaña RECIBIDAS_GASTOS).
--   · Retención IRPF practicada al proveedor (profesionales, art. 101 LIRPF).
--   · Bien de inversión: su IVA va en las casillas 30–31 del 303.
--   · % de IVA deducible (p. ej. 50 % en turismos no afectos en exclusiva).
--   · Concepto de gasto AEAT (G01…G48) para el libro de compras y gastos.
-- La empresa guarda la actividad (código, tipo y epígrafe IAE) que pide el libro.
-- =====================================================================

alter table gastos
  add column retencion_pct      numeric(4,2)  not null default 0   check (retencion_pct between 0 and 99.99),
  add column importe_retencion  numeric(12,2) not null default 0   check (importe_retencion >= 0),
  add column bien_inversion     boolean       not null default false,
  add column pct_deducible_iva  numeric(5,2)  not null default 100 check (pct_deducible_iva between 0 and 100),
  add column concepto_aeat      text          check (concepto_aeat ~ '^G[0-9Y][0-9]$');

comment on column gastos.retencion_pct is 'Retención IRPF practicada al proveedor (%). El importe pagado es total − importe_retencion.';
comment on column gastos.bien_inversion is 'Bien de inversión (art. 108 LIVA): IVA en casillas 30–31 del 303 y libro de bienes de inversión.';
comment on column gastos.pct_deducible_iva is 'Parte del IVA soportado que es deducible (100 por defecto; 50 en turismos no afectos en exclusiva).';
comment on column gastos.concepto_aeat is 'Concepto de gasto del libro registro AEAT (G01…G48). Vacío = sin clasificar.';

-- Un gasto menor (caja) no es una factura: sin retención ni bien de inversión.
alter table gastos add constraint gasto_menor_sin_datos_fiscales check (
  tipo <> 'menor' or (retencion_pct = 0 and importe_retencion = 0 and not bien_inversion)
);

alter table empresa
  add column actividad_codigo text check (actividad_codigo in ('A', 'B', 'C', 'D')),
  add column actividad_tipo   text check (actividad_tipo ~ '^[0-9]{2}$'),
  add column epigrafe_iae     text check (epigrafe_iae ~ '^[0-9A-Za-z.]{1,4}$');

comment on column empresa.actividad_codigo is 'Libros registro AEAT: A = actividad en el IAE, B = no incluida, C = no iniciada, D = arrendador.';
comment on column empresa.actividad_tipo is 'Libros registro AEAT: tipo dentro del código (p. ej. A03 empresarial, A05 profesional).';
comment on column empresa.epigrafe_iae is 'Grupo o epígrafe del IAE (4 posiciones).';

-- IVA soportado por trimestre: ahora distingue bienes de inversión y la cuota
-- realmente deducible. Las columnas nuevas van al final (create or replace).
create or replace view v_gastos_iva_trimestral with (security_invoker = on) as
select extract(year from fecha)::int    as ejercicio,
       extract(quarter from fecha)::int as trimestre,
       iva_pct,
       sum(base_imponible)              as base_imponible,
       sum(cuota_iva)                   as cuota_iva,
       count(*)                         as n_gastos,
       bien_inversion,
       sum(round(cuota_iva * pct_deducible_iva / 100, 2)) as cuota_deducible,
       sum(importe_retencion)           as importe_retencion
  from gastos
 where tipo = 'deducible' and estado in ('aprobado', 'reembolsado')
 group by 1, 2, 3, bien_inversion;
