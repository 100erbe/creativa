-- =====================================================================
-- CREATIVA — Causa de la rectificación (R1–R5) en las facturas rectificativas.
-- Es el «tipo de factura» que piden el libro registro de la AEAT y VeriFactu:
--   R1  error fundado en derecho y art. 80 Uno, Dos y Seis LIVA (devoluciones,
--       descuentos posteriores, operaciones anuladas)
--   R2  art. 80 Tres LIVA (concurso de acreedores)
--   R3  art. 80 Cuatro LIVA (créditos incobrables)
--   R4  resto de causas (errores en datos o importes)
--   R5  rectificativa de una factura simplificada
--   1. Columna causa_rectificacion; las rectificativas que ya existen quedan como R1
--      (hasta hoy el libro AEAT las exportaba todas como R1).
--   2. convertir_documento acepta la causa; si ya hay un borrador, le actualiza motivo y causa.
--   3. Una vez emitida, motivo y causa ya no se pueden cambiar (como los demás datos fiscales).
-- =====================================================================

alter table documentos
  add column causa_rectificacion text check (causa_rectificacion in ('R1', 'R2', 'R3', 'R4', 'R5'));

comment on column documentos.causa_rectificacion is
  'Causa de la rectificación (tipo de factura R1–R5 del libro registro AEAT / VeriFactu). Solo en rectificativas.';

update documentos set causa_rectificacion = 'R1' where tipo = 'rectificativa';

alter table documentos
  add constraint rectificativa_con_causa
  check ((tipo = 'rectificativa') = (causa_rectificacion is not null));

-- ---------------------------------------------------------------------
-- convertir_documento con causa (misma lógica que 0025 + p_causa)
-- ---------------------------------------------------------------------
drop function if exists convertir_documento(integer, tipo_documento, text);

create function convertir_documento(
  p_origen integer,
  p_tipo tipo_documento,
  p_motivo text default null,
  p_causa text default null
)
returns integer
language plpgsql
set search_path = public, pg_temp
as $$
declare o documentos%rowtype; v_nuevo int; v_signo int := 1; v_rectificado numeric; v_rectificativas text;
        v_causa text;
begin
  -- FOR UPDATE: dos conversiones a la vez del mismo origen se ejecutan una detrás de otra.
  select * into o from documentos where id = p_origen for update;
  if o.id is null then raise exception 'El documento % no existe', p_origen; end if;

  if p_tipo = 'rectificativa' then
    if o.tipo <> 'factura' or o.estado = 'borrador' then
      raise exception 'Solo se rectifican facturas emitidas';
    end if;
    v_causa := coalesce(p_causa, 'R1');
    if v_causa not in ('R1', 'R2', 'R3', 'R4', 'R5') then
      raise exception 'Causa de rectificación no válida (%)', v_causa;
    end if;
    -- Ya hay una rectificativa en borrador de esta factura: se sigue con esa, con el motivo nuevo si se indica.
    select id into v_nuevo from documentos
     where documento_origen_id = o.id and tipo = 'rectificativa' and estado = 'borrador'
     order by id limit 1;
    if v_nuevo is not null then
      update documentos set
        motivo_rectificacion = coalesce(nullif(trim(p_motivo), ''), motivo_rectificacion),
        causa_rectificacion  = coalesce(p_causa, causa_rectificacion)
      where id = v_nuevo;
      return v_nuevo;
    end if;
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
                          documento_origen_id, motivo_rectificacion, causa_rectificacion)
  values (p_tipo, (select id from series where tipo = p_tipo and por_defecto), o.cliente_id, o.campana,
          o.descripcion, o.campana_id, o.regimen_iva, o.motivo_exencion, o.forma_pago_id, o.cuenta_cobro_id,
          o.descuento_global_pct, o.retencion_pct, o.id,
          case when p_tipo = 'rectificativa'
               then coalesce(nullif(trim(p_motivo), ''), 'Rectifica la factura ' || o.numero_completo) end,
          v_causa)
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

revoke all on function convertir_documento(integer, tipo_documento, text, text) from public, anon;
grant execute on function convertir_documento(integer, tipo_documento, text, text) to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Datos fiscales congelados al emitir: se añaden motivo y causa de la rectificación.
-- ---------------------------------------------------------------------
create or replace function proteger_documento() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.tipo in ('factura','rectificativa') and old.estado <> 'borrador' then
      raise exception 'No se puede borrar una factura emitida (%). Anúlala con una rectificativa.', old.numero_completo;
    end if;
    return old;
  end if;
  new.actualizado_en := now();
  if old.tipo in ('factura','rectificativa') and old.estado <> 'borrador' then
    if (new.tipo, new.serie_id, new.anio, new.numero, new.fecha, new.cliente_id, new.cliente_razon_social,
        new.cliente_documento, new.base_imponible, new.cuota_iva, new.total, new.regimen_iva,
        new.motivo_rectificacion, new.causa_rectificacion)
       is distinct from
       (old.tipo, old.serie_id, old.anio, old.numero, old.fecha, old.cliente_id, old.cliente_razon_social,
        old.cliente_documento, old.base_imponible, old.cuota_iva, old.total, old.regimen_iva,
        old.motivo_rectificacion, old.causa_rectificacion) then
      raise exception 'La factura % ya está emitida: sus datos fiscales no se pueden cambiar.', old.numero_completo;
    end if;
    if new.estado = 'borrador' then
      raise exception 'Una factura emitida no puede volver a borrador.';
    end if;
  end if;
  return new;
end $$;
