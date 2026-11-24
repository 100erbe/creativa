-- =====================================================================
-- CREATIVA — Vencimientos que siguen la configuración (24/11/2026)
-- =====================================================================
-- Cada factura recuerda de dónde sale su vencimiento (documentos.vencimiento_origen):
--   Fijos (no cambian nunca solos):
--     'plazo'  plazo elegido en el borrador (30/60/90 días)
--     'fecha'  fecha puesta a mano, o fecha concreta impresa en la factura
--   Automáticos (se recalculan si cambia la configuración):
--     'cliente'     días de vencimiento de la ficha del cliente
--     'forma_pago'  días de la forma de pago del documento
--     'texto'       texto de pago de las facturas importadas («a la recepción» = días de la
--                   forma de pago «Transferencia a la recepción»; «a 90 días» = 90)
--     'general'     ajuste general de la empresa (30 días por defecto)
--
-- Al cambiar los días de un cliente, de una forma de pago o el ajuste general, se recalcula el
-- vencimiento de las facturas emitidas con vencimiento automático. Prioridad (la misma que al emitir):
-- cliente > forma de pago > texto de pago > ajuste general.
-- =====================================================================

alter table documentos
  add column vencimiento_origen text
  check (vencimiento_origen in ('plazo', 'fecha', 'cliente', 'forma_pago', 'texto', 'general'));

comment on column documentos.vencimiento_origen is
  'De dónde sale fecha_vencimiento. plazo/fecha = fijo; cliente/forma_pago/texto/general = se recalcula al cambiar la configuración.';

-- ---------------------------------------------------------------------
-- Vencimiento automático de un documento (sin plazo ni fecha propia)
-- ---------------------------------------------------------------------
create or replace function vencimiento_automatico(
  p_fecha date, p_cliente int, p_forma_pago int, p_texto text,
  out venc date, out origen text)
language plpgsql stable
set search_path = public, pg_temp
as $$
declare v_dias int;
begin
  select dias_vencimiento into v_dias from clientes where id = p_cliente;
  if v_dias is not null then venc := p_fecha + v_dias; origen := 'cliente'; return; end if;

  select dias_vencimiento into v_dias from formas_pago where id = p_forma_pago;
  if v_dias is not null then venc := p_fecha + v_dias; origen := 'forma_pago'; return; end if;

  if p_texto ilike '%recepci%' then
    venc := p_fecha + coalesce((select dias_vencimiento from formas_pago where id = 1), 15);
    origen := 'texto'; return;
  end if;
  if p_texto ~* '90 d[ií]as' then venc := p_fecha + 90; origen := 'texto'; return; end if;

  venc := p_fecha + coalesce((select vencimiento_defecto_dias from empresa where id = 1), 30);
  origen := 'general';
end $$;

-- ---------------------------------------------------------------------
-- Recalcula los vencimientos automáticos (de un cliente, o de todos si p_cliente es null)
-- ---------------------------------------------------------------------
create or replace function recalcular_vencimientos(p_cliente int default null)
returns int
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare n int;
begin
  update documentos d
     set fecha_vencimiento = a.venc, vencimiento_origen = a.origen
    from documentos x
    cross join lateral vencimiento_automatico(x.fecha, x.cliente_id, x.forma_pago_id, x.texto_forma_pago) a
   where d.id = x.id
     and x.tipo in ('factura', 'rectificativa') and x.estado <> 'borrador'
     and coalesce(x.vencimiento_origen, '') not in ('plazo', 'fecha')
     and (p_cliente is null or x.cliente_id = p_cliente)
     and (d.fecha_vencimiento, d.vencimiento_origen) is distinct from (a.venc, a.origen);
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function recalcular_vencimientos(int) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Disparadores: cliente, forma de pago y ajuste general
-- ---------------------------------------------------------------------
create or replace function tg_recalcular_vencimientos()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_table_name = 'clientes' then
    perform recalcular_vencimientos(new.id);
  else
    perform recalcular_vencimientos(null);
  end if;
  return null;
end $$;

create trigger recalcular_vencimientos_cliente
  after update of dias_vencimiento on clientes
  for each row when (old.dias_vencimiento is distinct from new.dias_vencimiento)
  execute function tg_recalcular_vencimientos();

create trigger recalcular_vencimientos_forma_pago
  after update of dias_vencimiento on formas_pago
  for each row when (old.dias_vencimiento is distinct from new.dias_vencimiento)
  execute function tg_recalcular_vencimientos();

create trigger recalcular_vencimientos_empresa
  after update of vencimiento_defecto_dias on empresa
  for each row when (old.vencimiento_defecto_dias is distinct from new.vencimiento_defecto_dias)
  execute function tg_recalcular_vencimientos();

-- ---------------------------------------------------------------------
-- emitir_documento: igual que en 0037, ahora guarda también vencimiento_origen
-- ---------------------------------------------------------------------
create or replace function emitir_documento(p_doc integer, p_fecha date default null)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare d documentos%rowtype; c clientes%rowtype; v_anio int; v_num int; v_ult date; v_venc date; v_texto text;
        v_otra text; o documentos%rowtype; v_rectificado numeric; v_rectificativas text;
        v_origen text; v_auto record;
begin
  select * into d from documentos where id = p_doc for update;
  if d.estado <> 'borrador' then raise exception 'El documento ya está emitido (%)', d.numero_completo; end if;
  if not exists (select 1 from lineas_documento where documento_id = p_doc) then
    raise exception 'El documento no tiene líneas';
  end if;

  if d.documento_origen_id is not null then
    select * into o from documentos where id = d.documento_origen_id for update;
  end if;

  -- Una factura que viene de un presupuesto/albarán: el origen no puede tener ya otra factura emitida.
  if d.tipo = 'factura' and o.id is not null then
    select numero_completo into v_otra from documentos
     where documento_origen_id = o.id and tipo = 'factura'
       and estado <> 'borrador' and id <> p_doc
     limit 1;
    if v_otra is not null then
      raise exception 'Este documento ya se facturó en la factura %', v_otra;
    end if;
  end if;

  -- Versión nueva de un presupuesto: la anterior tiene que seguir viva.
  if d.tipo = 'presupuesto' and o.tipo = 'presupuesto' and o.estado::text in ('facturado', 'anulado', 'sustituido') then
    raise exception 'El presupuesto % ya está %: esta versión no se puede emitir', o.numero_completo, o.estado;
  end if;

  -- Rectificativa de una factura: lo ya rectificado más esta no puede superar el total de la factura.
  if d.tipo = 'rectificativa' and o.tipo = 'factura' then
    select coalesce(sum(total), 0), string_agg(numero_completo, ', ' order by id)
      into v_rectificado, v_rectificativas
      from documentos
     where documento_origen_id = o.id and tipo = 'rectificativa'
       and estado <> 'borrador' and id <> p_doc;
    if o.total + v_rectificado + d.total < -0.005 then
      if o.total + v_rectificado <= 0.005 then
        raise exception 'La factura % ya está rectificada por completo (%): esta rectificativa no se puede emitir',
          o.numero_completo, v_rectificativas;
      end if;
      raise exception 'Esta rectificativa (% €) supera lo que queda por rectificar de la factura % (total % €%). Máximo rectificable: -% €',
        to_char(d.total, 'FM999999990.00'), o.numero_completo, to_char(o.total, 'FM999999990.00'),
        case when v_rectificativas is not null
             then ', ya rectificado ' || to_char(-v_rectificado, 'FM999999990.00') || ' € en ' || v_rectificativas
             else '' end,
        to_char(o.total + v_rectificado, 'FM999999990.00');
    end if;
  end if;

  d.fecha := coalesce(p_fecha, d.fecha);
  v_anio := extract(year from d.fecha);
  -- Las facturas de una serie deben ir en orden de fecha
  if d.tipo in ('factura','rectificativa') then
    select max(fecha) into v_ult from documentos
     where serie_id = d.serie_id and anio = v_anio and estado <> 'borrador';
    if v_ult is not null and d.fecha < v_ult then
      raise exception 'La fecha % es anterior a la última factura de la serie (%)', d.fecha, v_ult;
    end if;
  end if;
  insert into contadores_serie (serie_id, anio, ultimo) values (d.serie_id, v_anio, 1)
  on conflict (serie_id, anio) do update set ultimo = contadores_serie.ultimo + 1
  returning ultimo into v_num;

  select * into c from clientes where id = d.cliente_id;

  -- Vencimiento: plazo del borrador > fecha manual > ficha del cliente > forma de pago > ajuste general.
  if d.plazo_dias is not null then
    v_venc := d.fecha + d.plazo_dias; v_origen := 'plazo';
  elsif d.fecha_vencimiento is not null then
    v_venc := d.fecha_vencimiento; v_origen := 'fecha';
  else
    select * into v_auto from vencimiento_automatico(d.fecha, d.cliente_id, d.forma_pago_id, null);
    v_venc := v_auto.venc; v_origen := v_auto.origen;
    -- La forma de pago imprime la fecha («antes del dd/mm/aaaa»): queda fija, como la factura.
    if exists (select 1 from formas_pago where id = d.forma_pago_id and texto_factura like '%{plazo}%') then
      v_origen := 'fecha';
    end if;
  end if;

  v_texto := coalesce(
    d.texto_forma_pago,
    (select replace(
              texto_factura,
              '{plazo}',
              case when d.plazo_dias is not null then 'a ' || d.plazo_dias || ' días fecha factura'
                   else 'antes del ' || to_char(v_venc, 'DD/MM/YYYY') end)
       from formas_pago where id = d.forma_pago_id));

  update documentos set
    fecha = d.fecha, anio = v_anio, numero = v_num,
    numero_completo = formatear_numero(d.serie_id, v_anio, v_num),
    estado = 'emitido',
    cliente_razon_social = c.razon_social, cliente_documento = c.numero_documento,
    cliente_direccion = c.direccion, cliente_cp = c.codigo_postal, cliente_municipio = c.municipio,
    cliente_provincia = c.provincia, cliente_pais = c.pais,
    fecha_vencimiento = v_venc,
    vencimiento_origen = case when d.tipo in ('factura', 'rectificativa') then v_origen end,
    valido_hasta = case when d.tipo = 'presupuesto'
        then coalesce(d.valido_hasta, d.fecha + (select validez_presupuesto_dias from empresa where id = 1)) end,
    texto_forma_pago = v_texto,
    iban_cobro = coalesce(d.iban_cobro, (select iban from cuentas_bancarias where id = d.cuenta_cobro_id))
  where id = p_doc;

  -- Ahora sí: el origen queda facturado (factura) o sustituido (versión nueva del presupuesto).
  if d.tipo = 'factura' and o.tipo in ('presupuesto', 'albaran') then
    update documentos set estado = 'facturado' where id = o.id;
  elsif d.tipo = 'presupuesto' and o.tipo = 'presupuesto' then
    update documentos set estado = 'sustituido' where id = o.id;
  end if;

  return formatear_numero(d.serie_id, v_anio, v_num);
end $$;

-- ---------------------------------------------------------------------
-- Facturas ya emitidas (todas importadas): las que llevan una fecha concreta en el texto
-- de pago quedan fijas (ver 06_Audit/vencimientos_aplicados_2026-11-24.sql y DUDAS D-25);
-- las demás pasan a ser automáticas y se recalculan con la configuración actual.
-- ---------------------------------------------------------------------
update documentos set vencimiento_origen = 'fecha'
 where tipo in ('factura', 'rectificativa') and estado <> 'borrador'
   and (numero_completo in ('FAC-0134/26', 'FAC-0135/26', 'FAC-0106/26')
        or texto_forma_pago ilike '%30 Agosto 2024%'
        or texto_forma_pago ilike '%30/09/26%'
        or texto_forma_pago ilike '%25 Oct. 2026%'
        or texto_forma_pago ilike '%30/07/2026%'
        or texto_forma_pago ilike '%30 Nov. 2026%'
        or texto_forma_pago ilike 'Compensaci%Nov. 2026%'
        or texto_forma_pago ilike 'PAGADA%fecha factura%');

select recalcular_vencimientos(null);
