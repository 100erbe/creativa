-- =====================================================================
-- CREATIVA — Mejoras para que crear un albarán/factura sea más rápido
-- Requiere cargados: schema.sql, schema_documentos.sql, schema_campanas.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Cerrar el enlace documentos ↔ campañas (estaba previsto, ya no pendiente)
-- ---------------------------------------------------------------------
ALTER TABLE documentos
    ADD CONSTRAINT documentos_campana_fk
    FOREIGN KEY (campana_id) REFERENCES campanas(id);

CREATE INDEX idx_documentos_campana ON documentos (campana_id);

COMMENT ON COLUMN documentos.campana_id IS
    'Campaña a la que pertenece este documento. Una campaña puede tener varios '
    'albaranes/facturas (ej. una instalación por fases).';

-- ---------------------------------------------------------------------
-- 2. Duplicar un documento como punto de partida de uno nuevo
-- ---------------------------------------------------------------------
-- A diferencia de convertir_documento() (que cambia de tipo: presupuesto→
-- factura), esto crea un documento del MISMO tipo, en borrador, con las
-- mismas líneas. Pensado para trabajos repetidos con el mismo cliente
-- (ej. el tótem mensual, una campaña por fases).

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
        documento_id, orden, producto_id, formato_id, articulo, descripcion, alcance,
        unidad, piezas, ancho_cm, alto_cm, minimo_por_pieza,
        precio_fabricacion, precio_instalacion, precio_unitario,
        acabados, recargo_acabados, descuento_pct, iva_pct
    )
    SELECT
        v_nuevo, orden, producto_id, formato_id, articulo, descripcion, alcance,
        unidad, piezas, ancho_cm, alto_cm, minimo_por_pieza,
        precio_fabricacion, precio_instalacion, precio_unitario,
        acabados, recargo_acabados, descuento_pct, iva_pct
    FROM lineas_documento WHERE documento_id = p_origen ORDER BY orden;

    RETURN v_nuevo;
END $$;

COMMENT ON FUNCTION duplicar_documento(INT, DATE) IS
    'Copia un documento (mismo tipo) con sus líneas como borrador nuevo. '
    'Para repetir un trabajo sin volver a escribir cada línea.';

-- ---------------------------------------------------------------------
-- 3. "Lo que ya le facturé a este cliente": combos recientes, listos
--    para tocar y añadir en vez de rellenar un formulario desde cero.
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW v_lineas_recientes_cliente AS
SELECT DISTINCT ON (d.cliente_id, l.producto_id, l.formato_id, l.alcance)
    d.cliente_id,
    l.producto_id,
    p.nombre AS producto,
    l.formato_id,
    f.nombre AS formato,
    l.alcance,
    l.unidad,
    l.acabados,
    l.precio_unitario AS ultimo_precio,
    l.descuento_pct AS ultimo_descuento,
    d.fecha AS usado_en
FROM lineas_documento l
JOIN documentos d ON d.id = l.documento_id
JOIN productos p ON p.id = l.producto_id
LEFT JOIN formatos f ON f.id = l.formato_id
WHERE d.estado <> 'anulado'
ORDER BY d.cliente_id, l.producto_id, l.formato_id, l.alcance, d.fecha DESC;

COMMENT ON VIEW v_lineas_recientes_cliente IS
    'Último producto/formato/precio usado con cada cliente, para ofrecerlo '
    'como sugerencia de un toque al crear una nueva línea.';

-- ---------------------------------------------------------------------
-- 4. Plantillas de línea: "paquetes" con nombre amigable que el admin
--    cura una vez y luego cualquiera añade con un toque.
-- ---------------------------------------------------------------------
CREATE TABLE plantillas_linea (
    id                SERIAL PRIMARY KEY,
    nombre            TEXT NOT NULL,          -- "Tótem mensual", "Lona 2x1 con ollaos"
    producto_id       INT NOT NULL REFERENCES productos(id),
    formato_id        INT REFERENCES formatos(id),
    alcance           alcance_servicio NOT NULL DEFAULT 'fabricacion_instalacion',
    unidad            unidad_venta NOT NULL DEFAULT 'ud',
    acabados          INT[],
    piezas_sugeridas  NUMERIC(12,3) NOT NULL DEFAULT 1,
    orden_visual      INT NOT NULL DEFAULT 0, -- para ordenar los botones en la app
    activo            BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_plantillas_activas ON plantillas_linea(activo, orden_visual);

COMMENT ON TABLE plantillas_linea IS
    'Combos de producto+formato+acabados guardados con un nombre amigable, '
    'para que crear una línea sea elegir un botón en vez de rellenar un formulario.';

-- ---------------------------------------------------------------------
-- 5. Añadir una línea a partir de una plantilla o de lo "reciente",
--    resolviendo el precio automáticamente con precio_unitario().
--    Así la app solo tiene que pasar cliente + plantilla + piezas/medida.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION anadir_linea_rapida(
    p_documento INT,
    p_producto INT,
    p_formato INT,
    p_cliente INT,
    p_alcance alcance_servicio,
    p_piezas NUMERIC DEFAULT 1,
    p_ancho_cm NUMERIC DEFAULT NULL,
    p_alto_cm NUMERIC DEFAULT NULL,
    p_acabados INT[] DEFAULT NULL,
    p_descripcion TEXT DEFAULT NULL
) RETURNS INT LANGUAGE plpgsql AS $$
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
        unidad, piezas, ancho_cm, alto_cm, precio_unitario, acabados
    ) VALUES (
        p_documento, v_orden, p_producto, p_formato, v_desc, p_alcance,
        v_unidad, p_piezas, p_ancho_cm, p_alto_cm, v_precio, p_acabados
    ) RETURNING id INTO v_id;

    RETURN v_id;
END $$;

COMMENT ON FUNCTION anadir_linea_rapida IS
    'Añade una línea resolviendo el precio solo automáticamente. La app solo '
    'necesita mandar producto+formato+piezas/medida; el precio se calcula aquí.';
