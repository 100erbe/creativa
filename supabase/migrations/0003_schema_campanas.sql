-- =====================================================================
-- CREATIVA — Módulo de Campañas, Geolocalización, Usuarios y Permisos
-- Requiere cargados previamente: schema.sql y schema_documentos.sql
-- Pensado para Supabase: usuarios.id referencia auth.users(id) y las
-- políticas RLS usan auth.uid() para distinguir admin / empleado.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =====================================================================
-- 1. ENUMERADOS
-- =====================================================================

CREATE TYPE rol_usuario AS ENUM ('admin', 'empleado');

CREATE TYPE estado_campana AS ENUM (
    'planificada', 'en_curso', 'finalizada', 'cancelada'
);

CREATE TYPE tipo_soporte AS ENUM (
    'valla', 'totem', 'lona', 'cartel', 'mobiliario_urbano',
    'marquesina', 'pantalla', 'otro'
);

CREATE TYPE estado_punto AS ENUM (
    'pendiente', 'instalado', 'verificado', 'incidencia', 'retirado'
);

CREATE TYPE rol_asignacion AS ENUM ('instalador', 'supervisor', 'fotografo');

CREATE TYPE estado_asignacion AS ENUM (
    'pendiente', 'en_curso', 'completada', 'cancelada'
);

CREATE TYPE tipo_foto AS ENUM ('antes', 'instalacion', 'despues', 'incidencia');

-- =====================================================================
-- 2. USUARIOS (admin / empleado)
-- =====================================================================
-- En Supabase, cada fila corresponde 1:1 con un registro de auth.users.
-- El alta del usuario de autenticación se hace desde Supabase Auth
-- (invitación por email); esta tabla guarda el perfil y el rol de la app.
-- NOTA: fuera de Supabase (ej. pruebas locales) la referencia a auth.users
-- no existe, así que se comenta más abajo con una alternativa.

CREATE TABLE usuarios (
    id              UUID PRIMARY KEY,   -- = auth.users.id en Supabase
    nombre          TEXT NOT NULL,
    apellidos       TEXT,
    email           TEXT NOT NULL UNIQUE,
    telefono        TEXT,
    rol             rol_usuario NOT NULL DEFAULT 'empleado',
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    avatar_url      TEXT,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usuarios_rol ON usuarios(rol);

CREATE TRIGGER trg_usuarios_actualizado
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION tocar_actualizado();

COMMENT ON TABLE usuarios IS
    'Perfil de cada persona que accede a la app. En Supabase, id = auth.users.id '
    '(FK añadida en producción con: ALTER TABLE usuarios ADD CONSTRAINT usuarios_auth_fk '
    'FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;).';

-- Función auxiliar: ¿el usuario autenticado actual es admin activo?
-- SECURITY DEFINER para poder consultar "usuarios" desde dentro de las
-- políticas RLS de otras tablas sin recursión de permisos.
CREATE OR REPLACE FUNCTION es_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT EXISTS (
        SELECT 1 FROM usuarios
        WHERE id = auth.uid() AND rol = 'admin' AND activo
    );
$$;

COMMENT ON FUNCTION es_admin() IS
    'True si auth.uid() corresponde a un usuario con rol admin activo. Usar en políticas RLS.';

-- =====================================================================
-- 3. CAMPAÑAS
-- =====================================================================

CREATE TABLE campanas (
    id              SERIAL PRIMARY KEY,
    codigo          TEXT UNIQUE,              -- ej. CAMP-2026-014 (uso libre, opcional)
    nombre          TEXT NOT NULL,
    cliente_id      INT NOT NULL REFERENCES clientes(id),
    documento_id    INT REFERENCES documentos(id),  -- presupuesto o factura relacionada
    fecha_inicio    DATE,
    fecha_fin       DATE,
    estado          estado_campana NOT NULL DEFAULT 'planificada',
    descripcion     TEXT,
    creado_por      UUID REFERENCES usuarios(id),
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fechas_campana_coherentes
        CHECK (fecha_fin IS NULL OR fecha_inicio IS NULL OR fecha_fin >= fecha_inicio)
);

CREATE INDEX idx_campanas_cliente ON campanas(cliente_id);
CREATE INDEX idx_campanas_estado ON campanas(estado);
CREATE INDEX idx_campanas_documento ON campanas(documento_id);

CREATE TRIGGER trg_campanas_actualizado
    BEFORE UPDATE ON campanas
    FOR EACH ROW EXECUTE FUNCTION tocar_actualizado();

-- =====================================================================
-- 4. PUNTOS DE CAMPAÑA (ubicaciones geolocalizadas)
-- =====================================================================

CREATE TABLE puntos_campana (
    id                          SERIAL PRIMARY KEY,
    campana_id                  INT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
    nombre                      TEXT NOT NULL,       -- ej. "Totem Puerta del Sol"
    tipo_soporte                tipo_soporte NOT NULL,
    direccion                   TEXT,
    latitud                     NUMERIC(10,7) NOT NULL,
    longitud                    NUMERIC(10,7) NOT NULL,
    fecha_colocacion_prevista   DATE,
    fecha_retirada_prevista     DATE,
    estado                      estado_punto NOT NULL DEFAULT 'pendiente',
    notas                       TEXT,
    creado_en                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT coords_validas CHECK (
        latitud BETWEEN -90 AND 90 AND longitud BETWEEN -180 AND 180
    )
);

CREATE INDEX idx_puntos_campana ON puntos_campana(campana_id);
CREATE INDEX idx_puntos_estado ON puntos_campana(estado);

CREATE TRIGGER trg_puntos_actualizado
    BEFORE UPDATE ON puntos_campana
    FOR EACH ROW EXECUTE FUNCTION tocar_actualizado();

-- =====================================================================
-- 5. ASIGNACIONES (qué empleado trabaja en qué punto)
-- =====================================================================

CREATE TABLE asignaciones_punto (
    id                 SERIAL PRIMARY KEY,
    punto_id           INT NOT NULL REFERENCES puntos_campana(id) ON DELETE CASCADE,
    usuario_id         UUID NOT NULL REFERENCES usuarios(id),
    rol_asignacion     rol_asignacion NOT NULL DEFAULT 'instalador',
    estado             estado_asignacion NOT NULL DEFAULT 'pendiente',
    fecha_programada   DATE,
    fecha_completada   TIMESTAMPTZ,
    notas              TEXT,
    creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_asignaciones_punto ON asignaciones_punto(punto_id);
CREATE INDEX idx_asignaciones_usuario ON asignaciones_punto(usuario_id);

-- =====================================================================
-- 6. FOTOS DEL TRABAJO REALIZADO
-- =====================================================================
-- url_foto guarda la ruta dentro de un bucket de Supabase Storage
-- (ej. "trabajos/2026/punto_123/foto_1.jpg"), no la imagen en sí.

CREATE TABLE fotos_punto (
    id              SERIAL PRIMARY KEY,
    punto_id        INT NOT NULL REFERENCES puntos_campana(id) ON DELETE CASCADE,
    asignacion_id   INT REFERENCES asignaciones_punto(id),
    usuario_id      UUID NOT NULL REFERENCES usuarios(id),
    tipo            tipo_foto NOT NULL DEFAULT 'instalacion',
    url_foto        TEXT NOT NULL,
    latitud         NUMERIC(10,7),
    longitud        NUMERIC(10,7),
    tomada_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    notas           TEXT
);

CREATE INDEX idx_fotos_punto ON fotos_punto(punto_id);
CREATE INDEX idx_fotos_asignacion ON fotos_punto(asignacion_id);

-- =====================================================================
-- 7. ENLACES PARA EL CLIENTE (acceso público sin login)
-- =====================================================================

CREATE TABLE enlaces_cliente (
    id               SERIAL PRIMARY KEY,
    campana_id       INT NOT NULL REFERENCES campanas(id) ON DELETE CASCADE,
    token            TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
    creado_por       UUID REFERENCES usuarios(id),
    creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
    expira_en        TIMESTAMPTZ,
    activo           BOOLEAN NOT NULL DEFAULT TRUE,
    vistas           INT NOT NULL DEFAULT 0,
    ultima_vista_en  TIMESTAMPTZ
);

CREATE INDEX idx_enlaces_campana ON enlaces_cliente(campana_id);
CREATE INDEX idx_enlaces_token ON enlaces_cliente(token);

COMMENT ON COLUMN enlaces_cliente.token IS
    'Identificador aleatorio para la URL pública, ej. https://app.../c/<token>. '
    'No usar el id numérico como URL pública.';

-- =====================================================================
-- 8. ACCESO PÚBLICO PARA EL CLIENTE (vía token, sin autenticación)
-- =====================================================================
-- Estas funciones son SECURITY DEFINER: se ejecutan con permisos del
-- propietario y devuelven solo lo que el cliente debe ver, saltándose
-- la necesidad de exponer las tablas internas al rol "anon" de Supabase.

CREATE OR REPLACE FUNCTION obtener_campana_publica(p_token TEXT)
RETURNS TABLE (
    campana_nombre   TEXT,
    campana_estado   estado_campana,
    cliente_nombre   TEXT,
    fecha_inicio     DATE,
    fecha_fin        DATE,
    punto_id         INT,
    punto_nombre     TEXT,
    tipo_soporte     tipo_soporte,
    direccion        TEXT,
    latitud          NUMERIC,
    longitud         NUMERIC,
    punto_estado     estado_punto
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT c.nombre, c.estado, cl.razon_social,
           c.fecha_inicio, c.fecha_fin,
           p.id, p.nombre, p.tipo_soporte, p.direccion,
           p.latitud, p.longitud, p.estado
    FROM enlaces_cliente e
    JOIN campanas c ON c.id = e.campana_id
    JOIN clientes cl ON cl.id = c.cliente_id
    LEFT JOIN puntos_campana p ON p.campana_id = c.id
    WHERE e.token = p_token
      AND e.activo
      AND (e.expira_en IS NULL OR e.expira_en > now());
$$;

COMMENT ON FUNCTION obtener_campana_publica(TEXT) IS
    'Datos de campaña + puntos visibles para el cliente a partir del token del enlace. '
    'Llamar desde el rol anon de Supabase (sin login).';

CREATE OR REPLACE FUNCTION obtener_fotos_publicas(p_token TEXT)
RETURNS TABLE (
    punto_id    INT,
    punto_nombre TEXT,
    tipo        tipo_foto,
    url_foto    TEXT,
    tomada_en   TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
    SELECT p.id, p.nombre, f.tipo, f.url_foto, f.tomada_en
    FROM enlaces_cliente e
    JOIN campanas c ON c.id = e.campana_id
    JOIN puntos_campana p ON p.campana_id = c.id
    JOIN fotos_punto f ON f.punto_id = p.id
    WHERE e.token = p_token
      AND e.activo
      AND (e.expira_en IS NULL OR e.expira_en > now())
    ORDER BY f.tomada_en;
$$;

COMMENT ON FUNCTION obtener_fotos_publicas(TEXT) IS
    'Fotos del trabajo visibles para el cliente a partir del token del enlace.';

CREATE OR REPLACE FUNCTION registrar_vista_enlace(p_token TEXT)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER AS $$
    UPDATE enlaces_cliente
    SET vistas = vistas + 1, ultima_vista_en = now()
    WHERE token = p_token AND activo;
$$;

COMMENT ON FUNCTION registrar_vista_enlace(TEXT) IS
    'Incrementa el contador de vistas cada vez que el cliente abre el enlace.';

-- =====================================================================
-- 9. ROW LEVEL SECURITY
-- =====================================================================
-- Regla general:
--   - admin  → acceso total a todo este módulo.
--   - empleado → solo ve/edita lo relacionado con sus propias asignaciones.
--   - enlaces_cliente → solo admin (el cliente entra por las funciones
--     SECURITY DEFINER de arriba, no por consultar la tabla directamente).

ALTER TABLE usuarios            ENABLE ROW LEVEL SECURITY;
ALTER TABLE campanas             ENABLE ROW LEVEL SECURITY;
ALTER TABLE puntos_campana       ENABLE ROW LEVEL SECURITY;
ALTER TABLE asignaciones_punto   ENABLE ROW LEVEL SECURITY;
ALTER TABLE fotos_punto          ENABLE ROW LEVEL SECURITY;
ALTER TABLE enlaces_cliente      ENABLE ROW LEVEL SECURITY;

-- ---- usuarios ----
CREATE POLICY usuarios_admin_todo ON usuarios
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

CREATE POLICY usuarios_propio_select ON usuarios
    FOR SELECT USING (id = auth.uid());

CREATE POLICY usuarios_propio_update ON usuarios
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid() AND rol = (SELECT rol FROM usuarios WHERE id = auth.uid()));
    -- un empleado puede editar su perfil pero nunca su propio rol

-- ---- campanas ----
CREATE POLICY campanas_admin_todo ON campanas
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

CREATE POLICY campanas_empleado_select ON campanas
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM puntos_campana p
            JOIN asignaciones_punto a ON a.punto_id = p.id
            WHERE p.campana_id = campanas.id AND a.usuario_id = auth.uid()
        )
    );

-- ---- puntos_campana ----
CREATE POLICY puntos_admin_todo ON puntos_campana
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

CREATE POLICY puntos_empleado_select ON puntos_campana
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM asignaciones_punto a
            WHERE a.punto_id = puntos_campana.id AND a.usuario_id = auth.uid()
        )
    );

CREATE POLICY puntos_empleado_update_estado ON puntos_campana
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM asignaciones_punto a
            WHERE a.punto_id = puntos_campana.id AND a.usuario_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM asignaciones_punto a
            WHERE a.punto_id = puntos_campana.id AND a.usuario_id = auth.uid()
        )
    );
    -- el empleado puede actualizar el punto que tiene asignado (ej. marcarlo
    -- como instalado); restringir qué columnas puede tocar se hace en la app
    -- o con una columna-level GRANT si se necesita algo más estricto.

-- ---- asignaciones_punto ----
CREATE POLICY asignaciones_admin_todo ON asignaciones_punto
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

CREATE POLICY asignaciones_empleado_select ON asignaciones_punto
    FOR SELECT USING (usuario_id = auth.uid());

CREATE POLICY asignaciones_empleado_update ON asignaciones_punto
    FOR UPDATE USING (usuario_id = auth.uid())
    WITH CHECK (usuario_id = auth.uid());
    -- el empleado marca sus propias asignaciones como en_curso/completada

-- ---- fotos_punto ----
CREATE POLICY fotos_admin_todo ON fotos_punto
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());

CREATE POLICY fotos_empleado_select ON fotos_punto
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM asignaciones_punto a
            WHERE a.punto_id = fotos_punto.punto_id AND a.usuario_id = auth.uid()
        )
    );

CREATE POLICY fotos_empleado_insert ON fotos_punto
    FOR INSERT WITH CHECK (
        usuario_id = auth.uid()
        AND EXISTS (
            SELECT 1 FROM asignaciones_punto a
            WHERE a.punto_id = fotos_punto.punto_id AND a.usuario_id = auth.uid()
        )
    );
    -- un empleado solo puede subir fotos de un punto donde tiene asignación,
    -- y siempre a su propio nombre.

-- ---- enlaces_cliente ----
CREATE POLICY enlaces_admin_todo ON enlaces_cliente
    FOR ALL USING (es_admin()) WITH CHECK (es_admin());
    -- sin política para empleado: no ve ni crea enlaces.
    -- el cliente nunca consulta esta tabla directamente, solo a través de
    -- obtener_campana_publica() / obtener_fotos_publicas(), que son
    -- SECURITY DEFINER y por tanto no pasan por estas políticas.

-- =====================================================================
-- 10. VISTAS DE APOYO PARA LA APP
-- =====================================================================

-- Resumen de progreso de cada campaña, útil para el panel de admin.
CREATE OR REPLACE VIEW v_progreso_campana AS
SELECT
    c.id AS campana_id,
    c.nombre AS campana,
    c.estado AS estado_campana,
    cl.razon_social AS cliente,
    COUNT(p.id) AS puntos_totales,
    COUNT(p.id) FILTER (WHERE p.estado = 'instalado')  AS puntos_instalados,
    COUNT(p.id) FILTER (WHERE p.estado = 'verificado')  AS puntos_verificados,
    COUNT(p.id) FILTER (WHERE p.estado = 'incidencia')  AS puntos_con_incidencia,
    COUNT(p.id) FILTER (WHERE p.estado = 'pendiente')  AS puntos_pendientes,
    COUNT(DISTINCT f.id) AS fotos_subidas
FROM campanas c
JOIN clientes cl ON cl.id = c.cliente_id
LEFT JOIN puntos_campana p ON p.campana_id = c.id
LEFT JOIN fotos_punto f ON f.punto_id = p.id
GROUP BY c.id, c.nombre, c.estado, cl.razon_social;

COMMENT ON VIEW v_progreso_campana IS
    'Una fila por campaña con el recuento de puntos por estado y de fotos subidas.';

-- Agenda de cada empleado: qué tiene asignado y dónde.
CREATE OR REPLACE VIEW v_agenda_empleado AS
SELECT
    u.id AS usuario_id,
    u.nombre AS empleado,
    a.id AS asignacion_id,
    a.rol_asignacion,
    a.estado AS estado_asignacion,
    a.fecha_programada,
    c.id AS campana_id,
    c.nombre AS campana,
    p.id AS punto_id,
    p.nombre AS punto,
    p.direccion,
    p.latitud,
    p.longitud,
    p.tipo_soporte,
    p.estado AS estado_punto
FROM asignaciones_punto a
JOIN usuarios u ON u.id = a.usuario_id
JOIN puntos_campana p ON p.id = a.punto_id
JOIN campanas c ON c.id = p.campana_id;

COMMENT ON VIEW v_agenda_empleado IS
    'Lista de trabajo de cada empleado: asignación, punto, coordenadas y estado.';
