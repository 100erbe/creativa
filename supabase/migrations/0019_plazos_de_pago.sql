-- Plazos de pago a elegir (30/60/90 días) en las formas de pago aplazadas.
--
-- · formas_pago.plazos_dias: opciones de plazo que ofrece la forma de pago (vacío = no se ofrecen).
--   El texto de la forma de pago puede llevar «{plazo}»: al emitir se sustituye por «a N días fecha factura»
--   (si se eligió un plazo) o por «antes del dd/mm/aaaa» (si se puso una fecha a mano).
-- · documentos.plazo_dias: plazo elegido en el borrador. Se cuenta desde la fecha de emisión, así que si esa
--   fecha cambia, el vencimiento la sigue.

alter table public.formas_pago add column plazos_dias int[] not null default '{}';
alter table public.documentos add column plazo_dias int check (plazo_dias is null or plazo_dias between 1 and 365);

update public.formas_pago
   set plazos_dias = '{30,60,90}',
       texto_factura = '50 % a la recepción de esta factura; resto {plazo}'
 where id = 3;

create or replace function emitir_documento(p_doc int, p_fecha date default null)
returns text language plpgsql set search_path = public, pg_temp as $$
declare d documentos%rowtype; c clientes%rowtype; v_anio int; v_num int; v_ult date; v_venc date; v_texto text;
begin
  select * into d from documentos where id = p_doc for update;
  if d.estado <> 'borrador' then raise exception 'El documento ya está emitido (%)', d.numero_completo; end if;
  if not exists (select 1 from lineas_documento where documento_id = p_doc) then
    raise exception 'El documento no tiene líneas';
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

  -- Vencimiento: el plazo elegido (desde la fecha de emisión), si no la fecha puesta a mano, si no los días de la forma de pago.
  v_venc := coalesce(
    case when d.plazo_dias is not null then d.fecha + d.plazo_dias end,
    d.fecha_vencimiento,
    d.fecha + coalesce((select dias_vencimiento from formas_pago where id = d.forma_pago_id), 0));

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
    valido_hasta = case when d.tipo = 'presupuesto'
        then coalesce(d.valido_hasta, d.fecha + (select validez_presupuesto_dias from empresa where id = 1)) end,
    texto_forma_pago = v_texto,
    iban_cobro = coalesce(d.iban_cobro, (select iban from cuentas_bancarias where id = d.cuenta_cobro_id))
  where id = p_doc;
  return formatear_numero(d.serie_id, v_anio, v_num);
end $$;
