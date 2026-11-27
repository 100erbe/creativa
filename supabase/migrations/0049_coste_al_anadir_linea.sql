-- =====================================================================
-- CREATIVA — Margen bruto, fase 3 (27/11/2026)
-- Al añadir una línea del catálogo se copia su coste interno, igual que el precio:
--   fabricación → coste del formato o, si no tiene, del producto;
--   instalación → coste de instalación del producto (único por artículo);
--   ambos → la suma (NULL si falta alguna parte).
-- Mismo cálculo que costeUnitarioCatalogo() en src/lib/margen.ts.
-- =====================================================================

create or replace function public.coste_unitario_catalogo(p_producto integer, p_formato integer, p_alcance alcance_servicio)
 returns numeric
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select case p_alcance
           when 'fabricacion' then fab
           when 'instalacion' then inst
           else fab + inst
         end
    from (
      select coalesce(f.coste_fabricacion, p.coste_fabricacion) as fab,
             p.coste_instalacion as inst
        from productos p
        left join formatos f on f.id = p_formato and f.producto_id = p.id
       where p.id = p_producto
    ) c
$function$;
revoke all on function public.coste_unitario_catalogo(integer, integer, alcance_servicio) from public, anon;
grant execute on function public.coste_unitario_catalogo(integer, integer, alcance_servicio) to authenticated;

create or replace function public.anadir_linea(p_documento integer, p_producto integer, p_formato integer, p_alcance alcance_servicio, p_piezas numeric default 1, p_ancho_cm numeric default null, p_alto_cm numeric default null, p_precio numeric default null, p_descuento numeric default 0, p_descripcion text default null, p_artista text default null)
 returns integer
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
    v_cliente INT; v_unidad unidad_venta; v_min NUMERIC; v_iva NUMERIC; v_nombre TEXT;
    v_formato TEXT; v_cant NUMERIC; v_precio NUMERIC; v_orden INT; v_id INT;
BEGIN
    SELECT cliente_id INTO v_cliente FROM documentos WHERE id = p_documento;
    IF v_cliente IS NULL THEN RAISE EXCEPTION 'Documento % no existe', p_documento; END IF;

    SELECT unidad_venta, pedido_minimo, iva_pct, COALESCE(descripcion_factura, nombre)
      INTO v_unidad, v_min, v_iva, v_nombre
      FROM productos WHERE id = p_producto;
    IF v_unidad IS NULL THEN RAISE EXCEPTION 'Producto % no existe', p_producto; END IF;

    SELECT nombre INTO v_formato FROM formatos WHERE id = p_formato AND producto_id = p_producto;

    IF v_unidad IN ('m2','ml') AND p_ancho_cm IS NOT NULL THEN
        v_cant := cantidad_facturable(v_unidad, p_piezas, p_ancho_cm, p_alto_cm, v_min);
    ELSE
        v_cant := p_piezas;
    END IF;
    v_precio := COALESCE(p_precio, precio_unitario(p_producto, p_formato, v_cliente, v_cant, p_alcance));

    SELECT COALESCE(max(orden), 0) + 1 INTO v_orden FROM lineas_documento WHERE documento_id = p_documento;

    INSERT INTO lineas_documento (
        documento_id, orden, producto_id, formato_id, articulo, descripcion, artista, alcance, unidad,
        piezas, ancho_cm, alto_cm, minimo_por_pieza, precio_unitario, descuento_pct, iva_pct, coste_unitario
    ) VALUES (
        p_documento, v_orden, p_producto, p_formato, v_formato,
        COALESCE(NULLIF(trim(p_descripcion), ''), v_nombre || COALESCE(' · ' || v_formato, '')),
        NULLIF(trim(p_artista), ''),
        p_alcance, v_unidad, p_piezas, p_ancho_cm, p_alto_cm,
        CASE WHEN v_unidad = 'm2' THEN v_min END,
        v_precio, COALESCE(p_descuento, 0), v_iva,
        coste_unitario_catalogo(p_producto, p_formato, p_alcance)
    ) RETURNING id INTO v_id;

    RETURN v_id;
END $function$;

create or replace function public.anadir_linea_rapida(p_documento integer, p_producto integer, p_formato integer, p_cliente integer, p_alcance alcance_servicio, p_piezas numeric default 1, p_ancho_cm numeric default null, p_alto_cm numeric default null, p_acabados integer[] default null, p_descripcion text default null)
 returns integer
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
DECLARE
    v_cantidad NUMERIC;
    v_precio NUMERIC;
    v_unidad unidad_venta;
    v_min NUMERIC;
    v_desc TEXT;
    v_id INT;
    v_orden INT;
BEGIN
    SELECT unidad_venta, pedido_minimo, COALESCE(p_descripcion, nombre)
        INTO v_unidad, v_min, v_desc
    FROM productos WHERE id = p_producto;
    v_cantidad := cantidad_facturable(v_unidad, p_piezas, p_ancho_cm, p_alto_cm, v_min);
    v_precio := precio_unitario(p_producto, p_formato, p_cliente, v_cantidad, p_alcance);

    SELECT COALESCE(max(orden), 0) + 1 INTO v_orden FROM lineas_documento WHERE documento_id = p_documento;

    INSERT INTO lineas_documento (
        documento_id, orden, producto_id, formato_id, descripcion, alcance,
        unidad, piezas, ancho_cm, alto_cm, precio_unitario, acabados, coste_unitario
    ) VALUES (
        p_documento, v_orden, p_producto, p_formato, v_desc, p_alcance,
        v_unidad, p_piezas, p_ancho_cm, p_alto_cm, v_precio, p_acabados,
        coste_unitario_catalogo(p_producto, p_formato, p_alcance)
    ) RETURNING id INTO v_id;

    RETURN v_id;
END $function$;
