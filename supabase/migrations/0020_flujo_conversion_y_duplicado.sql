-- Flujo presupuesto/albarán → factura sin callejones sin salida, y duplicado sin datos caducados.
--
-- · convertir_documento: ya no marca el origen como «facturado» al crear la factura en borrador.
--   Comprueba el origen (emitido, ni facturado ni anulado) y, si ya existe una factura en borrador
--   de ese origen, devuelve esa en lugar de crear otra (doble clic, dos pestañas…).
--   Copia también el motivo de exención.
-- · emitir_documento: al emitir una factura que viene de un presupuesto/albarán, es entonces cuando
--   el origen pasa a «facturado». Si el origen ya tiene otra factura emitida, no deja emitir (doble factura).
--   Así, si se elimina la factura en borrador, el presupuesto sigue vivo y se puede volver a convertir.
-- · duplicar_documento: copia el motivo de exención y el plazo; el texto de pago y el IBAN ya congelados
--   al emitir el original no se copian (se recalculan al emitir), salvo en documentos sin forma de pago/cuenta.
-- · Datos: presupuestos/albaranes marcados «facturado» sin ninguna factura emitida vuelven a estar vivos.

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
    if o.estado in ('facturado', 'anulado') then
      raise exception 'El documento % ya está %', o.numero_completo, o.estado;
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
        v_otra text;
begin
  select * into d from documentos where id = p_doc for update;
  if d.estado <> 'borrador' then raise exception 'El documento ya está emitido (%)', d.numero_completo; end if;
  if not exists (select 1 from lineas_documento where documento_id = p_doc) then
    raise exception 'El documento no tiene líneas';
  end if;

  -- Una factura que viene de un presupuesto/albarán: el origen no puede tener ya otra factura emitida.
  if d.tipo = 'factura' and d.documento_origen_id is not null then
    perform 1 from documentos where id = d.documento_origen_id for update;
    select numero_completo into v_otra from documentos
     where documento_origen_id = d.documento_origen_id and tipo = 'factura'
       and estado <> 'borrador' and id <> p_doc
     limit 1;
    if v_otra is not null then
      raise exception 'Este documento ya se facturó en la factura %', v_otra;
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

  -- Ahora sí: el presupuesto/albarán de origen queda facturado.
  if d.tipo = 'factura' and d.documento_origen_id is not null then
    update documentos set estado = 'facturado'
     where id = d.documento_origen_id and tipo in ('presupuesto', 'albaran');
  end if;

  return formatear_numero(d.serie_id, v_anio, v_num);
end $$;


create or replace function duplicar_documento(p_origen int, p_fecha date default current_date)
returns int language plpgsql set search_path = public, pg_temp as $$
declare
    o documentos%rowtype;
    v_nuevo int;
begin
    select * into o from documentos where id = p_origen;
    if o.id is null then
        raise exception 'Documento % no existe', p_origen;
    end if;

    insert into documentos (
        tipo, serie_id, estado, fecha, cliente_id, campana, campana_id, descripcion,
        regimen_iva, motivo_exencion, forma_pago_id, plazo_dias, texto_forma_pago, cuenta_cobro_id, iban_cobro,
        descuento_global_pct, retencion_pct, notas_internas, notas_cliente, creado_por
    ) values (
        o.tipo, o.serie_id, 'borrador', p_fecha, o.cliente_id, o.campana, o.campana_id, o.descripcion,
        o.regimen_iva, o.motivo_exencion, o.forma_pago_id, o.plazo_dias,
        -- El texto de pago y el IBAN se congelan al emitir: con forma de pago / cuenta se recalculan.
        case when o.forma_pago_id is null then o.texto_forma_pago end,
        o.cuenta_cobro_id,
        case when o.cuenta_cobro_id is null then o.iban_cobro end,
        o.descuento_global_pct, o.retencion_pct, o.notas_internas, o.notas_cliente, o.creado_por
    ) returning id into v_nuevo;

    insert into lineas_documento (
        documento_id, orden, producto_id, formato_id, articulo, descripcion, artista, alcance,
        unidad, piezas, ancho_cm, alto_cm, minimo_por_pieza,
        precio_fabricacion, precio_instalacion, precio_unitario,
        acabados, recargo_acabados, descuento_pct, iva_pct
    )
    select
        v_nuevo, orden, producto_id, formato_id, articulo, descripcion, artista, alcance,
        unidad, piezas, ancho_cm, alto_cm, minimo_por_pieza,
        precio_fabricacion, precio_instalacion, precio_unitario,
        acabados, recargo_acabados, descuento_pct, iva_pct
    from lineas_documento where documento_id = p_origen order by orden;

    return v_nuevo;
end $$;


-- Presupuestos/albaranes «facturados» cuya factura aún no se ha emitido (o se eliminó): vuelven a estar vivos.
-- Si se estaban convirtiendo, el cliente los había aceptado.
update documentos o
   set estado = case when o.tipo = 'presupuesto' then 'aceptado'::estado_documento else 'emitido'::estado_documento end
 where o.estado = 'facturado'
   and o.tipo in ('presupuesto', 'albaran')
   and not exists (
     select 1 from documentos f
      where f.documento_origen_id = o.id and f.tipo = 'factura' and f.estado <> 'borrador'
   );
