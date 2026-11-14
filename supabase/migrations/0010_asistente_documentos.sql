-- =====================================================================
-- CREATIVA — Asistente de documentos rediseñado
--  · anadir_linea: añade una línea desde el catálogo con el precio de
--    tarifa por defecto, pero admite un precio manual y un descuento.
--  · previsualizar_precio: precio de tarifa + cantidad facturable, para
--    que la app lo muestre (editable) antes de añadir la línea.
--  · Guarda minimo_por_pieza en la línea (antes se perdía y el trigger
--    recalculaba la cantidad m² sin el mínimo).
-- =====================================================================

CREATE OR REPLACE FUNCTION previsualizar_precio(
    p_producto INT,
    p_formato INT,
    p_cliente INT,
    p_alcance alcance_servicio,
    p_piezas NUMERIC DEFAULT 1,
    p_ancho_cm NUMERIC DEFAULT NULL,
    p_alto_cm NUMERIC DEFAULT NULL
) RETURNS TABLE (precio NUMERIC, cantidad NUMERIC, unidad unidad_venta)
LANGUAGE plpgsql STABLE AS $$
DECLARE
    v_unidad unidad_venta; v_min NUMERIC; v_cant NUMERIC;
BEGIN
    SELECT p.unidad_venta, p.pedido_minimo INTO v_unidad, v_min FROM productos p WHERE p.id = p_producto;
    IF v_unidad IN ('m2','ml') AND p_ancho_cm IS NOT NULL THEN
        v_cant := cantidad_facturable(v_unidad, p_piezas, p_ancho_cm, p_alto_cm, v_min);
    ELSE
        v_cant := p_piezas;
    END IF;
    RETURN QUERY SELECT precio_unitario(p_producto, p_formato, p_cliente, v_cant, p_alcance), v_cant, v_unidad;
END $$;
ALTER FUNCTION previsualizar_precio(INT, INT, INT, alcance_servicio, NUMERIC, NUMERIC, NUMERIC)
    SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION anadir_linea(
    p_documento INT,
    p_producto INT,
    p_formato INT,
    p_alcance alcance_servicio,
    p_piezas NUMERIC DEFAULT 1,
    p_ancho_cm NUMERIC DEFAULT NULL,
    p_alto_cm NUMERIC DEFAULT NULL,
    p_precio NUMERIC DEFAULT NULL,      -- NULL = precio de tarifa
    p_descuento NUMERIC DEFAULT 0,
    p_descripcion TEXT DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql AS $$
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
        documento_id, orden, producto_id, formato_id, articulo, descripcion, alcance, unidad,
        piezas, ancho_cm, alto_cm, minimo_por_pieza, precio_unitario, descuento_pct, iva_pct
    ) VALUES (
        p_documento, v_orden, p_producto, p_formato, v_formato,
        COALESCE(NULLIF(trim(p_descripcion), ''), v_nombre || COALESCE(' · ' || v_formato, '')),
        p_alcance, v_unidad, p_piezas, p_ancho_cm, p_alto_cm,
        CASE WHEN v_unidad = 'm2' THEN v_min END,
        v_precio, COALESCE(p_descuento, 0), v_iva
    ) RETURNING id INTO v_id;

    RETURN v_id;
END $$;
ALTER FUNCTION anadir_linea(INT, INT, INT, alcance_servicio, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT)
    SET search_path = public, pg_temp;

COMMENT ON FUNCTION anadir_linea IS
    'Añade una línea del catálogo. Precio por defecto = tarifa (precio_unitario()); '
    'si la app manda p_precio se usa ese (precio modificado a mano). Admite descuento %.';
