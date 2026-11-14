-- =====================================================================
-- CREATIVA — Artista/referencia por línea y puntos ligados a artículos
--  · lineas_documento.artista: un mismo documento puede llevar varios
--    artistas (500 carteles del artista A, 300 del B). Sale impreso en
--    la factura debajo del concepto.
--  · puntos_campana.linea_id / piezas: cada punto de la campaña pertenece
--    a un artículo del documento (el soporte ya no se elige libremente).
-- =====================================================================

ALTER TABLE lineas_documento ADD COLUMN artista TEXT;
COMMENT ON COLUMN lineas_documento.artista IS
    'Artista / referencia de la línea (texto libre). Se imprime en el documento.';

ALTER TABLE puntos_campana
    ADD COLUMN linea_id INT REFERENCES lineas_documento(id) ON DELETE SET NULL,
    ADD COLUMN piezas NUMERIC(12,3) CHECK (piezas IS NULL OR piezas > 0);
CREATE INDEX idx_puntos_linea ON puntos_campana (linea_id);

-- ---------------------------------------------------------------------
-- anadir_linea con artista
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS anadir_linea(INT, INT, INT, alcance_servicio, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION anadir_linea(
    p_documento INT,
    p_producto INT,
    p_formato INT,
    p_alcance alcance_servicio,
    p_piezas NUMERIC DEFAULT 1,
    p_ancho_cm NUMERIC DEFAULT NULL,
    p_alto_cm NUMERIC DEFAULT NULL,
    p_precio NUMERIC DEFAULT NULL,
    p_descuento NUMERIC DEFAULT 0,
    p_descripcion TEXT DEFAULT NULL,
    p_artista TEXT DEFAULT NULL
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
        documento_id, orden, producto_id, formato_id, articulo, descripcion, artista, alcance, unidad,
        piezas, ancho_cm, alto_cm, minimo_por_pieza, precio_unitario, descuento_pct, iva_pct
    ) VALUES (
        p_documento, v_orden, p_producto, p_formato, v_formato,
        COALESCE(NULLIF(trim(p_descripcion), ''), v_nombre || COALESCE(' · ' || v_formato, '')),
        NULLIF(trim(p_artista), ''),
        p_alcance, v_unidad, p_piezas, p_ancho_cm, p_alto_cm,
        CASE WHEN v_unidad = 'm2' THEN v_min END,
        v_precio, COALESCE(p_descuento, 0), v_iva
    ) RETURNING id INTO v_id;

    RETURN v_id;
END $$;
ALTER FUNCTION anadir_linea(INT, INT, INT, alcance_servicio, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT, TEXT)
    SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- duplicar / convertir: copian también el artista
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION duplicar_documento(p_origen INT, p_fecha DATE DEFAULT CURRENT_DATE)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
    o documentos%ROWTYPE;
    v_nuevo INT;
BEGIN
    SELECT * INTO o FROM documentos WHERE id = p_origen;
    IF o.id IS NULL THEN
        RAISE EXCEPTION 'Documento % no existe', p_origen;
    END IF;

    INSERT INTO documentos (
        tipo, serie_id, estado, fecha, cliente_id, campana, campana_id, descripcion,
        regimen_iva, forma_pago_id, texto_forma_pago, cuenta_cobro_id, iban_cobro,
        descuento_global_pct, retencion_pct, notas_internas, notas_cliente, creado_por
    ) VALUES (
        o.tipo, o.serie_id, 'borrador', p_fecha, o.cliente_id, o.campana, o.campana_id, o.descripcion,
        o.regimen_iva, o.forma_pago_id, o.texto_forma_pago, o.cuenta_cobro_id, o.iban_cobro,
        o.descuento_global_pct, o.retencion_pct, o.notas_internas, o.notas_cliente, o.creado_por
    ) RETURNING id INTO v_nuevo;

    INSERT INTO lineas_documento (
        documento_id, orden, producto_id, formato_id, articulo, descripcion, artista, alcance,
        unidad, piezas, ancho_cm, alto_cm, minimo_por_pieza,
        precio_fabricacion, precio_instalacion, precio_unitario,
        acabados, recargo_acabados, descuento_pct, iva_pct
    )
    SELECT
        v_nuevo, orden, producto_id, formato_id, articulo, descripcion, artista, alcance,
        unidad, piezas, ancho_cm, alto_cm, minimo_por_pieza,
        precio_fabricacion, precio_instalacion, precio_unitario,
        acabados, recargo_acabados, descuento_pct, iva_pct
    FROM lineas_documento WHERE documento_id = p_origen ORDER BY orden;

    RETURN v_nuevo;
END $$;
ALTER FUNCTION duplicar_documento(INT, DATE) SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION convertir_documento(p_origen INT, p_tipo tipo_documento, p_motivo TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE o documentos%ROWTYPE; v_nuevo INT; v_signo INT := 1;
BEGIN
  SELECT * INTO o FROM documentos WHERE id = p_origen;
  IF p_tipo = 'rectificativa' THEN
    IF o.tipo <> 'factura' OR o.estado = 'borrador' THEN
      RAISE EXCEPTION 'Solo se rectifican facturas emitidas';
    END IF;
    v_signo := -1;
  END IF;
  INSERT INTO documentos (tipo, serie_id, cliente_id, campana, descripcion, campana_id, regimen_iva, motivo_exencion,
                          forma_pago_id, cuenta_cobro_id, descuento_global_pct, retencion_pct,
                          documento_origen_id, motivo_rectificacion)
  VALUES (p_tipo, (SELECT id FROM series WHERE tipo = p_tipo AND por_defecto), o.cliente_id, o.campana,
          o.descripcion, o.campana_id, o.regimen_iva, o.motivo_exencion, o.forma_pago_id, o.cuenta_cobro_id,
          o.descuento_global_pct, o.retencion_pct, o.id,
          CASE WHEN p_tipo = 'rectificativa'
               THEN COALESCE(p_motivo, 'Rectifica la factura ' || o.numero_completo) END)
  RETURNING id INTO v_nuevo;
  INSERT INTO lineas_documento (documento_id, orden, producto_id, formato_id, articulo, descripcion, artista, alcance, unidad,
         piezas, ancho_cm, alto_cm, minimo_por_pieza, precio_fabricacion, precio_instalacion, precio_unitario,
         acabados, recargo_acabados, descuento_pct, iva_pct)
  SELECT v_nuevo, orden, producto_id, formato_id, articulo, descripcion, artista, alcance, unidad,
         piezas * v_signo, ancho_cm, alto_cm, minimo_por_pieza, precio_fabricacion, precio_instalacion, precio_unitario,
         acabados, recargo_acabados, descuento_pct, iva_pct
    FROM lineas_documento WHERE documento_id = p_origen ORDER BY orden;
  IF o.tipo IN ('presupuesto','albaran') AND p_tipo = 'factura' THEN
    UPDATE documentos SET estado = 'facturado' WHERE id = p_origen;
  END IF;
  RETURN v_nuevo;
END $$;
ALTER FUNCTION convertir_documento(INT, tipo_documento, TEXT) SET search_path = public, pg_temp;
