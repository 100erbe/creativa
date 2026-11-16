-- =====================================================================
-- CREATIVA — Rectificativas: una sola por factura y compensación abono ↔ factura.
-- No modifica ningún documento ni cobro existente.
--   1. convertir_documento: si la factura ya tiene una rectificativa en borrador se
--      sigue con esa; si ya está rectificada por completo, error claro.
--   2. compensar_rectificativa: cierra un abono contra una factura emitida del mismo
--      cliente (por defecto, la que rectifica) con dos cobros «compensacion» de signo opuesto.
-- =====================================================================

create or replace function convertir_documento(p_origen integer, p_tipo tipo_documento, p_motivo text default null)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare o documentos%rowtype; v_nuevo int; v_signo int := 1; v_rectificado numeric; v_rectificativas text;
begin
  -- FOR UPDATE: dos conversiones a la vez del mismo origen se ejecutan una detrás de otra.
  select * into o from documentos where id = p_origen for update;
  if o.id is null then raise exception 'El documento % no existe', p_origen; end if;

  if p_tipo = 'rectificativa' then
    if o.tipo <> 'factura' or o.estado = 'borrador' then
      raise exception 'Solo se rectifican facturas emitidas';
    end if;
    -- Ya hay una rectificativa en borrador de esta factura: se sigue con esa.
    select id into v_nuevo from documentos
     where documento_origen_id = o.id and tipo = 'rectificativa' and estado = 'borrador'
     order by id limit 1;
    if v_nuevo is not null then return v_nuevo; end if;
    -- Rectificativas ya emitidas: si cubren todo el importe, no cabe otra.
    select coalesce(sum(total), 0), string_agg(numero_completo, ', ' order by id)
      into v_rectificado, v_rectificativas
      from documentos
     where documento_origen_id = o.id and tipo = 'rectificativa' and estado <> 'borrador';
    if v_rectificativas is not null and o.total + v_rectificado <= 0.005 then
      raise exception 'La factura % ya está rectificada por completo (%)', o.numero_completo, v_rectificativas;
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

-- ---------------------------------------------------------------------
-- Compensación: el importe es lo menor entre lo que queda por devolver del abono
-- y lo que queda por cobrar de la factura. Devuelve el importe compensado.
-- ---------------------------------------------------------------------
create or replace function compensar_rectificativa(
  p_rectificativa integer,
  p_factura integer default null,
  p_fecha date default null
)
returns numeric
language plpgsql
set search_path = public, pg_temp
as $$
declare r documentos%rowtype; f documentos%rowtype; v_pend_r numeric; v_pend_f numeric; v_importe numeric;
begin
  if not es_admin() then raise exception 'Solo un administrador puede compensar documentos'; end if;

  select * into r from documentos where id = p_rectificativa for update;
  if r.id is null or r.tipo <> 'rectificativa' or r.estado = 'borrador' then
    raise exception 'Solo se compensan rectificativas emitidas';
  end if;

  select * into f from documentos where id = coalesce(p_factura, r.documento_origen_id) for update;
  if f.id is null then
    raise exception 'La rectificativa % no indica la factura que rectifica: elige con qué factura compensarla', r.numero_completo;
  end if;
  if f.tipo <> 'factura' or f.estado = 'borrador' then raise exception 'Solo se compensa con una factura emitida'; end if;
  if f.cliente_id <> r.cliente_id then raise exception 'La factura y la rectificativa son de clientes distintos'; end if;

  select r.total - coalesce(sum(importe), 0) into v_pend_r from cobros where documento_id = r.id;
  select f.total - coalesce(sum(importe), 0) into v_pend_f from cobros where documento_id = f.id;

  if v_pend_r > -0.005 then
    raise exception 'La rectificativa % no tiene importe pendiente a favor del cliente', r.numero_completo;
  end if;
  if v_pend_f < 0.005 then
    raise exception 'La factura % ya está cobrada: el abono se cierra registrando la devolución al cliente', f.numero_completo;
  end if;

  v_importe := round(least(-v_pend_r, v_pend_f), 2);

  insert into cobros (documento_id, fecha, importe, metodo, referencia, notas) values
    (f.id, coalesce(p_fecha, current_date),  v_importe, 'compensacion', r.numero_completo,
     'Compensado con la rectificativa ' || r.numero_completo),
    (r.id, coalesce(p_fecha, current_date), -v_importe, 'compensacion', f.numero_completo,
     'Compensada con la factura ' || f.numero_completo);

  return v_importe;
end $$;

revoke all on function compensar_rectificativa(integer, integer, date) from public, anon;
grant execute on function compensar_rectificativa(integer, integer, date) to authenticated, service_role;
