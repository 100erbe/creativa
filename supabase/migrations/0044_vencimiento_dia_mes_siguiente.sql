-- =====================================================================
-- CREATIVA — Vencimiento «día N del mes siguiente» (24/11/2026)
-- =====================================================================
-- Además de «N días desde la fecha de la factura», el vencimiento por defecto del cliente y el
-- ajuste general pueden ser «el día N del mes siguiente» (p. ej. día 30). Si el mes siguiente no
-- tiene ese día (febrero), vence el último día del mes: 15/01 → 28/02 (29 en bisiesto).
--
--   clientes.vencimiento_dia_mes          si está puesto, manda sobre dias_vencimiento (que queda vacío)
--   empresa.vencimiento_defecto_dia_mes   si está puesto, manda sobre vencimiento_defecto_dias
--
-- La prioridad no cambia: cliente > forma de pago > texto de pago > ajuste general. Al cambiar el
-- tipo de vencimiento del cliente o el general se recalculan, como hasta ahora, los vencimientos
-- automáticos de las facturas emitidas (las que no tienen plazo ni fecha propios).
-- =====================================================================

alter table clientes
  add column vencimiento_dia_mes smallint check (vencimiento_dia_mes between 1 and 31),
  add constraint clientes_vencimiento_un_tipo check (vencimiento_dia_mes is null or dias_vencimiento is null);

comment on column clientes.vencimiento_dia_mes is
  'Vencimiento por defecto «día N del mes siguiente» (1–31; si el mes no lo tiene, último día). Excluye dias_vencimiento.';

alter table empresa
  add column vencimiento_defecto_dia_mes smallint check (vencimiento_defecto_dia_mes between 1 and 31);

comment on column empresa.vencimiento_defecto_dia_mes is
  'Ajuste general «día N del mes siguiente» (1–31). Si está puesto, manda sobre vencimiento_defecto_dias.';

-- ---------------------------------------------------------------------
-- Día N del mes siguiente a una fecha (último día del mes si no existe)
-- ---------------------------------------------------------------------
create or replace function dia_del_mes_siguiente(p_fecha date, p_dia int)
returns date
language sql immutable
set search_path = public, pg_temp
as $$
  select (date_trunc('month', p_fecha) + interval '1 month')::date
         + (least(p_dia,
                  extract(day from date_trunc('month', p_fecha) + interval '2 month' - interval '1 day')::int) - 1)
$$;

-- ---------------------------------------------------------------------
-- Vencimiento automático: igual que en 0043, con el «día del mes siguiente»
-- ---------------------------------------------------------------------
create or replace function vencimiento_automatico(
  p_fecha date, p_cliente int, p_forma_pago int, p_texto text,
  out venc date, out origen text)
language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_dias int; v_dia_mes int;
begin
  select dias_vencimiento, vencimiento_dia_mes into v_dias, v_dia_mes from clientes where id = p_cliente;
  if v_dia_mes is not null then venc := dia_del_mes_siguiente(p_fecha, v_dia_mes); origen := 'cliente'; return; end if;
  if v_dias is not null then venc := p_fecha + v_dias; origen := 'cliente'; return; end if;

  select dias_vencimiento into v_dias from formas_pago where id = p_forma_pago;
  if v_dias is not null then venc := p_fecha + v_dias; origen := 'forma_pago'; return; end if;

  if p_texto ilike '%recepci%' then
    venc := p_fecha + coalesce((select dias_vencimiento from formas_pago where id = 1), 15);
    origen := 'texto'; return;
  end if;
  if p_texto ~* '90 d[ií]as' then venc := p_fecha + 90; origen := 'texto'; return; end if;

  select vencimiento_defecto_dias, vencimiento_defecto_dia_mes into v_dias, v_dia_mes from empresa where id = 1;
  venc := case when v_dia_mes is not null then dia_del_mes_siguiente(p_fecha, v_dia_mes)
               else p_fecha + coalesce(v_dias, 30) end;
  origen := 'general';
end $$;

-- ---------------------------------------------------------------------
-- Disparadores: también al cambiar el «día del mes siguiente»
-- ---------------------------------------------------------------------
drop trigger recalcular_vencimientos_cliente on clientes;
create trigger recalcular_vencimientos_cliente
  after update of dias_vencimiento, vencimiento_dia_mes on clientes
  for each row when (old.dias_vencimiento is distinct from new.dias_vencimiento
                     or old.vencimiento_dia_mes is distinct from new.vencimiento_dia_mes)
  execute function tg_recalcular_vencimientos();

drop trigger recalcular_vencimientos_empresa on empresa;
create trigger recalcular_vencimientos_empresa
  after update of vencimiento_defecto_dias, vencimiento_defecto_dia_mes on empresa
  for each row when (old.vencimiento_defecto_dias is distinct from new.vencimiento_defecto_dias
                     or old.vencimiento_defecto_dia_mes is distinct from new.vencimiento_defecto_dia_mes)
  execute function tg_recalcular_vencimientos();
