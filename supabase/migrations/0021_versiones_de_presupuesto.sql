-- Versiones de un presupuesto: modificar y reenviar un presupuesto ya emitido sin perder el rastro.
--
-- · Nuevo estado «sustituido»: el presupuesto tiene una versión posterior emitida y sale del flujo
--   (ya no se convierte en factura ni cambia de seguimiento).
-- · documentos.version: 1 en el original, +1 en cada versión nueva.
-- · nueva_version_presupuesto(): crea la versión siguiente como borrador, enlazada con
--   documento_origen_id. Si ya hay una en borrador, devuelve esa.
-- · emitir_documento(): al emitir la versión nueva, la anterior pasa a «sustituido» (no antes:
--   si se elimina el borrador de la versión, el presupuesto original sigue vivo).
-- · convertir_documento(): no convierte un presupuesto sustituido ni uno con una versión nueva en borrador.

alter type estado_documento add value if not exists 'sustituido' after 'facturado';

alter table documentos add column if not exists version int not null default 1 check (version >= 1);


create or replace function nueva_version_presupuesto(p_origen int)
returns int language plpgsql set search_path = public, pg_temp as $$
declare o documentos%rowtype; v_nuevo int;
begin
  select * into o from documentos where id = p_origen for update;
  if o.id is null then raise exception 'El documento % no existe', p_origen; end if;
  if o.tipo <> 'presupuesto' then raise exception 'Solo los presupuestos tienen versiones'; end if;
  if o.estado::text not in ('emitido', 'enviado', 'aceptado', 'rechazado', 'caducado') then
    raise exception 'El presupuesto % está % y no admite una nueva versión', o.numero_completo, o.estado;
  end if;

  -- Ya hay una versión nueva en borrador: se sigue con esa.
  select id into v_nuevo from documentos
   where documento_origen_id = o.id and tipo = 'presupuesto' and estado = 'borrador'
   order by id limit 1;
  if v_nuevo is not null then return v_nuevo; end if;

  if exists (select 1 from documentos where documento_origen_id = o.id and tipo = 'factura' and estado = 'borrador') then
    raise exception 'Este presupuesto tiene una factura en borrador: emítela o elimínala antes de crear otra versión';
  end if;

  v_nuevo := duplicar_documento(o.id);
  update documentos set documento_origen_id = o.id, version = o.version + 1 where id = v_nuevo;
  return v_nuevo;
end $$;


create or replace function convertir_documento(p_origen int, p_tipo tipo_documento, p_motivo text default null)
returns int language plpgsql set search_path = public, pg_temp as $$
declare o documentos%rowtype; v_nuevo int; v_signo int := 1;
begin
  -- FOR UPDATE: dos conversiones a la vez del mismo origen se ejecutan una detrás de otra.
  select * into o from documentos where id = p_origen for update;
  if o.id is null then raise exception 'El documento % no existe', p_origen; end if;

  if p_tipo = 'rectificativa' then
    if o.tipo <> 'factura' or o.estado = 'borrador' then
      raise exception 'Solo se rectifican facturas emitidas';
    end if;
    v_signo := -1;
  elsif p_tipo = 'factura' then
    if o.tipo not in ('presupuesto', 'albaran') then
      raise exception 'Solo los presupuestos y albaranes se convierten en factura';
    end if;
    if o.estado = 'borrador' then
      raise exception 'Emite el documento antes de convertirlo en factura';
    end if;
    if o.estado::text in ('facturado', 'anulado', 'sustituido') then
      raise exception 'El documento % ya está %', o.numero_completo, o.estado;
    end if;
    if exists (select 1 from documentos where documento_origen_id = o.id and tipo = 'presupuesto' and estado = 'borrador') then
      raise exception 'Hay una versión nueva de este presupuesto en borrador: emítela o elimínala antes de facturar';
    end if;
    -- Ya hay una factura en borrador de este origen: se sigue con esa.
    select id into v_nuevo from documentos
     where documento_origen_id = o.id and tipo = 'factura' and estado = 'borrador'
     order by id limit 1;
    if v_nuevo is not null then return v_nuevo; end if;
  else
    raise exception 'Conversión no válida (%)', p_tipo;
  end if;

  insert into documentos (tipo, serie_id, cliente_id, campana, descripcion, campana_id, regimen_iva, motivo_exencion,
                          forma_pago_id, cuenta_cobro_id, descuento_global_pct, retencion_pct,
                          documento_origen_id, motivo_rectificacion)
  values (p_tipo, (select id from series where tipo = p_tipo and por_defecto), o.cliente_id, o.campana,
          o.descripcion, o.campana_id, o.regimen_iva, o.motivo_exencion, o.forma_pago_id, o.cuenta_cobro_id,
          o.descuento_global_pct, o.retencion_pct, o.id,
          case when p_tipo = 'rectificativa'
               then coalesce(p_motivo, 'Rectifica la factura ' || o.numero_completo) end)
  returning id into v_nuevo;

  insert into lineas_documento (documento_id, orden, producto_id, formato_id, articulo, descripcion, artista, alcance, unidad,
         piezas, ancho_cm, alto_cm, minimo_por_pieza, precio_fabricacion, precio_instalacion, precio_unitario,
         acabados, recargo_acabados, descuento_pct, iva_pct)
  select v_nuevo, orden, producto_id, formato_id, articulo, descripcion, artista, alcance, unidad,
         piezas * v_signo, ancho_cm, alto_cm, minimo_por_pieza, precio_fabricacion, precio_instalacion, precio_unitario,
         acabados, recargo_acabados, descuento_pct, iva_pct
    from lineas_documento where documento_id = p_origen order by orden;

  -- El origen pasa a «facturado» al emitir la factura (ver emitir_documento), no ahora.
  return v_nuevo;
end $$;


create or replace function emitir_documento(p_doc int, p_fecha date default null)
returns text language plpgsql set search_path = public, pg_temp as $$
declare d documentos%rowtype; c clientes%rowtype; v_anio int; v_num int; v_ult date; v_venc date; v_texto text;
        v_otra text; o documentos%rowtype;
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
