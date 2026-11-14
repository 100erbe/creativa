-- =====================================================================
-- CREATIVA — Seguridad: activar RLS en todas las tablas públicas,
-- fijar search_path en funciones y hacer que las vistas respeten RLS
-- (security_invoker) salvo las pensadas para saltarla.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Activar RLS + política "solo admin" en las tablas de clientes,
--    catálogo, documentos y configuración (todas gestionadas solo
--    por el admin; el empleado no las toca directamente).
-- ---------------------------------------------------------------------

ALTER TABLE grupos_empresariales ENABLE ROW LEVEL SECURITY;
CREATE POLICY grupos_empresariales_admin_todo ON grupos_empresariales
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY clientes_admin_todo ON clientes
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE formas_pago ENABLE ROW LEVEL SECURITY;
CREATE POLICY formas_pago_admin_todo ON formas_pago
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE cuentas_bancarias ENABLE ROW LEVEL SECURITY;
CREATE POLICY cuentas_bancarias_admin_todo ON cuentas_bancarias
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE contactos_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY contactos_cliente_admin_todo ON contactos_cliente
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
CREATE POLICY categorias_admin_todo ON categorias
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
CREATE POLICY productos_admin_todo ON productos
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE formatos ENABLE ROW LEVEL SECURITY;
CREATE POLICY formatos_admin_todo ON formatos
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE producto_acabados ENABLE ROW LEVEL SECURITY;
CREATE POLICY producto_acabados_admin_todo ON producto_acabados
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE acabados ENABLE ROW LEVEL SECURITY;
CREATE POLICY acabados_admin_todo ON acabados
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE tarifas_volumen ENABLE ROW LEVEL SECURITY;
CREATE POLICY tarifas_volumen_admin_todo ON tarifas_volumen
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE tarifas_cliente ENABLE ROW LEVEL SECURITY;
CREATE POLICY tarifas_cliente_admin_todo ON tarifas_cliente
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE empresa ENABLE ROW LEVEL SECURITY;
CREATE POLICY empresa_admin_todo ON empresa
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE series ENABLE ROW LEVEL SECURITY;
CREATE POLICY series_admin_todo ON series
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE contadores_serie ENABLE ROW LEVEL SECURITY;
CREATE POLICY contadores_serie_admin_todo ON contadores_serie
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY documentos_admin_todo ON documentos
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE lineas_documento ENABLE ROW LEVEL SECURITY;
CREATE POLICY lineas_documento_admin_todo ON lineas_documento
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE cobros ENABLE ROW LEVEL SECURITY;
CREATE POLICY cobros_admin_todo ON cobros
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

ALTER TABLE plantillas_linea ENABLE ROW LEVEL SECURITY;
CREATE POLICY plantillas_linea_admin_todo ON plantillas_linea
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

-- ---------------------------------------------------------------------
-- 2. Fijar search_path en todas las funciones (evita que una ruta de
--    búsqueda manipulada cambie a qué tabla/función apunta una llamada).
-- ---------------------------------------------------------------------

ALTER FUNCTION precio_unitario(INT, INT, INT, NUMERIC, alcance_servicio, DATE) SET search_path = public, pg_temp;
ALTER FUNCTION cantidad_facturable(unidad_venta, NUMERIC, NUMERIC, NUMERIC, NUMERIC) SET search_path = public, pg_temp;
ALTER FUNCTION tocar_actualizado() SET search_path = public, pg_temp;
ALTER FUNCTION formatear_numero(INT, INT, INT) SET search_path = public, pg_temp;
ALTER FUNCTION calcular_linea() SET search_path = public, pg_temp;
ALTER FUNCTION recalcular_documento(INT) SET search_path = public, pg_temp;
ALTER FUNCTION trg_lineas_recalcular() SET search_path = public, pg_temp;
ALTER FUNCTION trg_cabecera_recalcular() SET search_path = public, pg_temp;
ALTER FUNCTION proteger_lineas() SET search_path = public, pg_temp;
ALTER FUNCTION proteger_documento() SET search_path = public, pg_temp;
ALTER FUNCTION emitir_documento(INT, DATE) SET search_path = public, pg_temp;
ALTER FUNCTION convertir_documento(INT, tipo_documento, TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION es_admin() SET search_path = public, pg_temp;
ALTER FUNCTION obtener_campana_publica(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION obtener_fotos_publicas(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION registrar_vista_enlace(TEXT) SET search_path = public, pg_temp;
ALTER FUNCTION duplicar_documento(INT, DATE) SET search_path = public, pg_temp;
ALTER FUNCTION anadir_linea_rapida(INT, INT, INT, INT, alcance_servicio, NUMERIC, NUMERIC, NUMERIC, INT[], TEXT) SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 3. Vistas: que respeten los permisos y RLS de quien consulta (admin),
--    en vez de los del creador de la vista (comportamiento por defecto
--    de Postgres, que el linter marca como SECURITY DEFINER).
-- ---------------------------------------------------------------------

ALTER VIEW v_catalogo SET (security_invoker = on);
ALTER VIEW v_estado_cobro SET (security_invoker = on);
ALTER VIEW v_libro_registro SET (security_invoker = on);
ALTER VIEW v_resumen_iva_trimestral SET (security_invoker = on);
ALTER VIEW v_pendiente_facturar SET (security_invoker = on);
ALTER VIEW v_lineas_recientes_cliente SET (security_invoker = on);
ALTER VIEW v_progreso_campana SET (security_invoker = on);
ALTER VIEW v_agenda_empleado SET (security_invoker = on);

-- ---------------------------------------------------------------------
-- NOTA: quedan 4 avisos (WARN, no ERROR) tras esta migración, y son
-- intencionados:
--   - obtener_campana_publica / obtener_fotos_publicas / registrar_vista_enlace
--     DEBEN ser ejecutables por el rol "anon": son la base del enlace
--     público /c/[token] que el cliente abre sin iniciar sesión.
--   - es_admin() es ejecutable por cualquiera, pero solo devuelve un
--     booleano sobre el propio usuario autenticado; no expone datos.
-- =====================================================================
