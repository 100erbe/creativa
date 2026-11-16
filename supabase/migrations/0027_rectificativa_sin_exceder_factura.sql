-- =====================================================================
-- CREATIVA — Una rectificativa no puede llevar lo rectificado más allá del importe
-- de la factura. Si una factura ya tiene rectificativas emitidas que no la cubren
-- entera, convertir_documento crea otra con TODAS las líneas en negativo; al emitirla
-- se comprueba ahora que la suma (emitidas + esta) no supere el total de la factura,
-- y el error indica el máximo que aún se puede rectificar.
-- Solo cambia emitir_documento (misma firma y permisos). No toca ningún documento.
-- =====================================================================

create or replace function emitir_documento(p_doc integer, p_fecha date default null)
returns text
language plpgsql
set search_path = public, pg_temp
as $$
declare d documentos%rowtype; c clientes%rowtype; v_anio int; v_num int; v_ult date; v_venc date; v_texto text;
        v_otra text; o documentos%rowtype; v_rectificado numeric; v_rectificativas text;
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

  -- Ahora sí: el origen queda facturado (factura) o sustituido (versión nueva del presupuesto).
  if d.tipo = 'factura' and o.tipo in ('presupuesto', 'albaran') then
    update documentos set estado = 'facturado' where id = o.id;
  elsif d.tipo = 'presupuesto' and o.tipo = 'presupuesto' then
    update documentos set estado = 'sustituido' where id = o.id;
  end if;

  return formatear_numero(d.serie_id, v_anio, v_num);
end $$;
