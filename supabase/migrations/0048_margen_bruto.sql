-- =====================================================================
-- CREATIVA — Margen bruto (fase 1 del plan PIANO_MARGEN_BRUTO.md, 27/11/2026)
--   1. Coste interno aproximado en el catálogo (producto y formato).
--   2. Coste copiado en cada línea del documento (editable, también en facturas emitidas:
--      no es un dato fiscal y no cambia importes ni totales).
--   3. Conversión y duplicado de documentos copian el coste.
--   4. Vistas de margen por línea y por documento (solo admin, vía RLS de las tablas).
-- El coste NUNCA se imprime ni se envía al cliente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Columnas de coste
-- ---------------------------------------------------------------------
alter table productos
  add column if not exists coste_fabricacion numeric(10,4) check (coste_fabricacion >= 0),
  add column if not exists coste_instalacion numeric(10,4) check (coste_instalacion >= 0);
comment on column productos.coste_fabricacion is 'Coste interno aproximado de fabricación/suministro (€ por unidad_venta). Nunca visible para el cliente.';
comment on column productos.coste_instalacion is 'Coste interno aproximado de instalación/servicio (€ por unidad_venta). Nunca visible para el cliente.';

alter table formatos
  add column if not exists coste_fabricacion numeric(10,4) check (coste_fabricacion >= 0);
comment on column formatos.coste_fabricacion is 'Coste de fabricación propio del formato; NULL = el del producto. La instalación usa siempre el coste del producto.';

alter table lineas_documento
  add column if not exists coste_unitario numeric(10,4) check (coste_unitario >= 0);
comment on column lineas_documento.coste_unitario is 'Coste interno € por unidad (fab + inst según alcance), copiado del catálogo y editable. NULL = sin coste.';

-- ---------------------------------------------------------------------
-- 2. El coste se puede corregir también en facturas emitidas
-- ---------------------------------------------------------------------
create or replace function public.proteger_lineas()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE v_estado estado_documento; v_tipo tipo_documento;
BEGIN
  -- Cambiar solo el coste interno no toca la factura (ni importes ni totales).
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'coste_unitario') = (to_jsonb(OLD) - 'coste_unitario') THEN
    RETURN NEW;
  END IF;
  SELECT estado, tipo INTO v_estado, v_tipo FROM documentos
   WHERE id = COALESCE(NEW.documento_id, OLD.documento_id);
  IF v_tipo IN ('factura','rectificativa') AND v_estado <> 'borrador' THEN
    RAISE EXCEPTION 'La factura ya está emitida: no se pueden modificar sus líneas. Emite una factura rectificativa.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $function$;

create or replace function public.trg_lineas_recalcular()
 returns trigger
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
BEGIN
  -- Solo ha cambiado el coste: los totales del documento no cambian.
  IF TG_OP = 'UPDATE'
     AND (to_jsonb(NEW) - 'coste_unitario') = (to_jsonb(OLD) - 'coste_unitario') THEN
    RETURN NULL;
  END IF;
  PERFORM recalcular_documento(COALESCE(NEW.documento_id, OLD.documento_id));
  IF TG_OP = 'UPDATE' AND NEW.documento_id <> OLD.documento_id THEN
    PERFORM recalcular_documento(OLD.documento_id);
  END IF;
  RETURN NULL;
END $function$;

-- ---------------------------------------------------------------------
-- 3. Conversión y duplicado copian el coste de cada línea
-- ---------------------------------------------------------------------
create or replace function public.duplicar_documento(p_origen integer, p_fecha date default current_date)
 returns integer
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
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
        acabados, recargo_acabados, descuento_pct, iva_pct, coste_unitario
    )
    select
        v_nuevo, orden, producto_id, formato_id, articulo, descripcion, artista, alcance,
        unidad, piezas, ancho_cm, alto_cm, minimo_por_pieza,
        precio_fabricacion, precio_instalacion, precio_unitario,
        acabados, recargo_acabados, descuento_pct, iva_pct, coste_unitario
    from lineas_documento where documento_id = p_origen order by orden;

    return v_nuevo;
end $function$;

create or replace function public.convertir_documento(p_origen integer, p_tipo tipo_documento, p_motivo text default null, p_causa text default null)
 returns integer
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare o documentos%rowtype; v_nuevo int; v_signo int := 1; v_rectificado numeric; v_rectificativas text;
        v_causa text;
begin
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

  -- En la rectificativa las piezas cambian de signo: el coste unitario se copia tal cual
  -- y el coste total (cantidad × coste) sale negativo, igual que el importe.
  insert into lineas_documento (documento_id, orden, producto_id, formato_id, articulo, descripcion, artista, alcance, unidad,
         piezas, ancho_cm, alto_cm, minimo_por_pieza, precio_fabricacion, precio_instalacion, precio_unitario,
         acabados, recargo_acabados, descuento_pct, iva_pct, coste_unitario)
  select v_nuevo, orden, producto_id, formato_id, articulo, descripcion, artista, alcance, unidad,
         piezas * v_signo, ancho_cm, alto_cm, minimo_por_pieza, precio_fabricacion, precio_instalacion, precio_unitario,
         acabados, recargo_acabados, descuento_pct, iva_pct, coste_unitario
    from lineas_documento where documento_id = p_origen order by orden;

  return v_nuevo;
end $function$;

-- ---------------------------------------------------------------------
-- 4. Vistas de margen (security_invoker: solo el admin ve filas)
--    Base neta de la línea = importe tras descuento de línea y descuento global, sin IVA.
--    Líneas sin coste: fuera del cálculo del % (contarlas a coste 0 daría un falso 100 %).
-- ---------------------------------------------------------------------
create or replace view public.v_margen_lineas with (security_invoker = on) as
select
  l.id                as linea_id,
  l.documento_id,
  d.tipo,
  d.estado,
  d.fecha,
  d.cliente_id,
  l.producto_id,
  l.formato_id,
  l.descripcion,
  l.unidad,
  l.cantidad,
  round(l.importe * (1 - d.descuento_global_pct / 100), 2)                       as base_neta,
  l.coste_unitario,
  round(l.cantidad * l.coste_unitario, 2)                                         as coste_total,
  round(l.importe * (1 - d.descuento_global_pct / 100), 2)
    - round(l.cantidad * l.coste_unitario, 2)                                     as beneficio
from lineas_documento l
join documentos d on d.id = l.documento_id;

create or replace view public.v_margen_documentos with (security_invoker = on) as
select
  d.id                                                                  as documento_id,
  d.tipo,
  d.estado,
  d.fecha,
  d.cliente_id,
  d.base_imponible,
  count(m.linea_id)                                                     as lineas,
  count(m.linea_id) filter (where m.coste_unitario is null)            as lineas_sin_coste,
  coalesce(sum(m.base_neta) filter (where m.coste_unitario is null), 0) as base_sin_coste,
  coalesce(sum(m.base_neta) filter (where m.coste_unitario is not null), 0) as base_con_coste,
  coalesce(sum(m.coste_total), 0)                                       as coste_total,
  coalesce(sum(m.beneficio), 0)                                         as beneficio,
  case
    when coalesce(sum(m.base_neta) filter (where m.coste_unitario is not null), 0) <> 0
    then round(100 * sum(m.beneficio)
               / sum(m.base_neta) filter (where m.coste_unitario is not null), 1)
  end                                                                   as margen_pct
from documentos d
left join v_margen_lineas m on m.documento_id = d.id
group by d.id;

revoke all on public.v_margen_lineas, public.v_margen_documentos from anon;
