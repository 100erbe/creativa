-- =====================================================================
--  CREATIVA · Esquema de base de datos (PostgreSQL / Supabase)
--  Módulos: CLIENTES y CATÁLOGO DE PRODUCTOS
--  Versión 0.1 · 13/11/2026
--  Todos los nombres están en español (la app es íntegramente en español).
-- =====================================================================

-- ---------------------------------------------------------------------
--  0. Tipos enumerados
-- ---------------------------------------------------------------------
CREATE TYPE tipo_persona      AS ENUM ('juridica', 'fisica');
CREATE TYPE tipo_documento_id AS ENUM ('NIF', 'CIF', 'NIE', 'VAT_UE', 'OTRO');

-- Cómo se relaciona el cliente con Creativa: define tarifas y condiciones
CREATE TYPE tipo_cliente AS ENUM (
  'agencia_revendedor',     -- imprentas y agencias que revenden (Krea, Benalsign, Oedim, Urbanstyle…)
  'promotor_productora',    -- promotores de conciertos, teatros, festivales (Grupo Mundo, Brisa, Classic Stage…)
  'marca_empresa',          -- anunciante final (Sea Life, Almacenes Benamiel, Costa 10…)
  'institucion_asociacion', -- ayuntamientos, museos, ONG, clubes (Cruz Roja, Museo del Grabado…)
  'particular'
);

-- Régimen de IVA que se aplica por defecto en sus facturas
CREATE TYPE regimen_iva AS ENUM (
  'general',            -- 21 %
  'reducido',           -- 10 %
  'intracomunitario',   -- 0 %, inversión del sujeto pasivo (p.ej. Elevate S.R.O.)
  'exento'              -- 0 %, con motivo de exención
);

-- Unidad en la que se vende / se calcula el precio de un producto
CREATE TYPE unidad_venta AS ENUM (
  'ud',        -- unidad (carteles, banderolas, rígidos de formato fijo)
  'm2',        -- metro cuadrado (lonas, telas, vinilos a medida)
  'ml',        -- metro lineal (velcro, vaina, refuerzo perimetral)
  'millar',    -- por cada 1.000 uds (flyers, folletos)
  'mes',       -- alquiler mensual (tótems, vallas)
  'servicio',  -- tarifa plana / partida alzada
  'km'         -- desplazamiento
);

-- Qué incluye una línea: solo fabricar, solo instalar/fijar, o ambas cosas
CREATE TYPE alcance_servicio AS ENUM ('fabricacion', 'instalacion', 'fabricacion_instalacion');


-- ---------------------------------------------------------------------
--  1. CLIENTES
-- ---------------------------------------------------------------------

-- Grupos de empresas que comparten domicilio/gestión (para informes y riesgo)
CREATE TABLE grupos_empresariales (
  id          SERIAL PRIMARY KEY,
  nombre      TEXT NOT NULL UNIQUE,
  notas       TEXT
);

CREATE TABLE formas_pago (
  id           SERIAL PRIMARY KEY,
  nombre       TEXT NOT NULL UNIQUE,          -- 'Transferencia a la recepción', '50 % + resto a 30 días'…
  dias_vencimiento INT NOT NULL DEFAULT 0,
  texto_factura    TEXT                        -- texto que se imprime en la factura
);

-- Cuentas bancarias de Creativa donde se cobra (Santander, Cajamar…)
CREATE TABLE cuentas_bancarias (
  id         SERIAL PRIMARY KEY,
  banco      TEXT NOT NULL,
  iban       TEXT NOT NULL UNIQUE,
  por_defecto BOOLEAN NOT NULL DEFAULT false,
  activa     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE clientes (
  id                  SERIAL PRIMARY KEY,
  codigo              TEXT NOT NULL UNIQUE,          -- CLI-001, CLI-002…
  tipo_persona        tipo_persona NOT NULL DEFAULT 'juridica',
  razon_social        TEXT NOT NULL,                 -- nombre fiscal exacto que sale en la factura
  nombre_comercial    TEXT,                          -- nombre corto/habitual ("Mundo", "Krea")
  tipo_documento      tipo_documento_id NOT NULL DEFAULT 'CIF',
  numero_documento    TEXT,                          -- B-92611318 (NULL = por determinar)
  -- Domicilio fiscal
  direccion           TEXT,
  codigo_postal       TEXT,
  municipio           TEXT,
  provincia           TEXT,
  pais                CHAR(2) NOT NULL DEFAULT 'ES', -- ISO 3166 (ES, CZ…)
  -- Contacto general
  email_facturacion   TEXT,
  telefono            TEXT,
  web                 TEXT,
  -- Clasificación comercial
  tipo_cliente        tipo_cliente NOT NULL DEFAULT 'marca_empresa',
  grupo_id            INT REFERENCES grupos_empresariales(id),
  -- Condiciones de facturación por defecto
  regimen_iva         regimen_iva NOT NULL DEFAULT 'general',
  motivo_exencion     TEXT,                          -- obligatorio si exento/intracomunitario
  forma_pago_id       INT REFERENCES formas_pago(id),
  cuenta_cobro_id     INT REFERENCES cuentas_bancarias(id),
  descuento_habitual  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_habitual BETWEEN 0 AND 100),
  -- Control
  activo              BOOLEAN NOT NULL DEFAULT true,
  notas               TEXT,
  creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT documento_unico UNIQUE NULLS NOT DISTINCT (tipo_documento, numero_documento, razon_social),
  CONSTRAINT exencion_motivada CHECK (regimen_iva IN ('general','reducido') OR motivo_exencion IS NOT NULL)
);
CREATE INDEX idx_clientes_documento ON clientes (numero_documento);
CREATE INDEX idx_clientes_tipo      ON clientes (tipo_cliente);

-- Personas de contacto (un cliente puede tener varias: producción, administración…)
CREATE TABLE contactos_cliente (
  id          SERIAL PRIMARY KEY,
  cliente_id  INT NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  cargo       TEXT,                 -- 'Producción', 'Administración', 'Dirección'
  email       TEXT,
  telefono    TEXT,
  recibe_facturas BOOLEAN NOT NULL DEFAULT false,
  recibe_enlace_campana BOOLEAN NOT NULL DEFAULT true,  -- a quién se envía el link con las fotos
  notas       TEXT
);


-- ---------------------------------------------------------------------
--  2. CATÁLOGO DE PRODUCTOS
--     Patrón: CATEGORÍA → PRODUCTO (material/servicio) → FORMATO (medidas)
--             + ACABADOS opcionales + TARIFAS (volumen / cliente)
-- ---------------------------------------------------------------------

CREATE TABLE categorias (
  id        SERIAL PRIMARY KEY,
  codigo    TEXT NOT NULL UNIQUE,   -- CAR, BAN, LON, TEL, RIG, VIN, DIS, ALQ, IMP, SRV
  nombre    TEXT NOT NULL,
  orden     INT NOT NULL DEFAULT 0
);

-- Producto = un material o servicio con una forma de cálculo de precio
CREATE TABLE productos (
  id                   SERIAL PRIMARY KEY,
  codigo               TEXT NOT NULL UNIQUE,            -- LON-FRL-510
  categoria_id         INT NOT NULL REFERENCES categorias(id),
  nombre               TEXT NOT NULL,                   -- 'Lona Frontlit 510 g'
  descripcion_factura  TEXT,                            -- texto largo que se imprime en la factura
  material             TEXT,                            -- 'PVC Frontlit 510 g/m²', 'Papel 115 g'…
  unidad_venta         unidad_venta NOT NULL,
  -- Formato: fijo (sólo los de la tabla formatos) o a medida (ancho x alto libre → m²)
  admite_medida_libre  BOOLEAN NOT NULL DEFAULT false,
  -- Qué partes tiene el trabajo y su precio base (si no hay formato con precio propio)
  permite_fabricacion  BOOLEAN NOT NULL DEFAULT true,
  permite_instalacion  BOOLEAN NOT NULL DEFAULT true,
  precio_fabricacion   NUMERIC(10,4),                   -- € por unidad_venta
  precio_instalacion   NUMERIC(10,4),                   -- € por unidad_venta (fijar, volar, montar)
  pedido_minimo        NUMERIC(10,2),                   -- p.ej. 1 m² mínimo facturable
  iva_pct              NUMERIC(5,2) NOT NULL DEFAULT 21,
  activo               BOOLEAN NOT NULL DEFAULT true,
  notas                TEXT,
  CONSTRAINT medida_libre_solo_superficie CHECK (NOT admite_medida_libre OR unidad_venta IN ('m2','ml'))
);

-- Formato = medida estándar de un producto (A3, 70x100, banderola 80x120…)
-- Si el producto se vende por m², el formato sólo sirve de atajo: el m² se calcula solo.
CREATE TABLE formatos (
  id                 SERIAL PRIMARY KEY,
  producto_id        INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  codigo             TEXT NOT NULL,                     -- '70x100', 'A3', 'MAXI'
  nombre             TEXT NOT NULL,                     -- 'Cartel 70x100 (70C)'
  ancho_cm           NUMERIC(8,2),
  alto_cm            NUMERIC(8,2),
  superficie_m2      NUMERIC(10,4) GENERATED ALWAYS AS (ancho_cm * alto_cm / 10000) STORED,
  -- Precio propio del formato (si es NULL se usa el del producto)
  precio_fabricacion NUMERIC(10,4),
  precio_instalacion NUMERIC(10,4),
  alias              TEXT[],                            -- nombres de calle: {'70C','cartel grande'}
  activo             BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (producto_id, codigo)
);

-- Acabados / confecciones opcionales con recargo (ollaos, vaina, velcro, keder…)
CREATE TABLE acabados (
  id            SERIAL PRIMARY KEY,
  codigo        TEXT NOT NULL UNIQUE,                   -- OLL, VAI, VAI2, VEL-M, VEL-H, KED, RAS
  nombre        TEXT NOT NULL,
  unidad_recargo unidad_venta NOT NULL,                 -- m2 (sobre la superficie), ml (perímetro) o ud
  precio        NUMERIC(10,4) NOT NULL DEFAULT 0,
  notas         TEXT
);

-- Qué acabados admite cada producto (y cuál viene incluido por defecto)
CREATE TABLE producto_acabados (
  producto_id   INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  acabado_id    INT NOT NULL REFERENCES acabados(id),
  incluido      BOOLEAN NOT NULL DEFAULT false,         -- true = ya está en el precio base
  PRIMARY KEY (producto_id, acabado_id)
);

-- Descuentos por volumen (0,60 € → 0,55 € a partir de 500 uds…)
CREATE TABLE tarifas_volumen (
  id                 SERIAL PRIMARY KEY,
  producto_id        INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  formato_id         INT REFERENCES formatos(id) ON DELETE CASCADE,
  cantidad_desde     NUMERIC(12,2) NOT NULL,
  precio_fabricacion NUMERIC(10,4),
  precio_instalacion NUMERIC(10,4),
  UNIQUE NULLS NOT DISTINCT (producto_id, formato_id, cantidad_desde)
);

-- Precio pactado con un cliente o con un tipo de cliente (revendedores pagan menos)
CREATE TABLE tarifas_cliente (
  id                 SERIAL PRIMARY KEY,
  producto_id        INT NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  formato_id         INT REFERENCES formatos(id) ON DELETE CASCADE,
  cliente_id         INT REFERENCES clientes(id) ON DELETE CASCADE,
  tipo_cliente       tipo_cliente,
  precio_fabricacion NUMERIC(10,4),
  precio_instalacion NUMERIC(10,4),
  vigente_desde      DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta      DATE,
  notas              TEXT,
  CONSTRAINT cliente_o_tipo CHECK ((cliente_id IS NULL) <> (tipo_cliente IS NULL))
);


-- ---------------------------------------------------------------------
--  3. Cálculo de precio de una línea (lo usarán presupuestos y facturas)
--     importe = cantidad_facturable × (P_fab·[fab] + P_inst·[inst]) + acabados
--     · ud / millar / mes / servicio / km → cantidad_facturable = cantidad
--     · m2 → piezas × ancho × alto / 10.000 (con mínimo por pieza)
--     · ml → piezas × 2·(ancho + alto) / 100   (perímetro)
--     Prioridad de precio: tarifa del cliente > tarifa por tipo de cliente
--                          > tarifa por volumen > formato > producto
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION precio_unitario(
  p_producto INT, p_formato INT, p_cliente INT, p_cantidad NUMERIC,
  p_alcance alcance_servicio, p_fecha DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_fab NUMERIC; v_inst NUMERIC; v_tipo tipo_cliente; r RECORD;
BEGIN
  SELECT tipo_cliente INTO v_tipo FROM clientes WHERE id = p_cliente;

  -- 1) producto / formato
  SELECT COALESCE(f.precio_fabricacion, p.precio_fabricacion) AS fab,
         COALESCE(f.precio_instalacion, p.precio_instalacion) AS inst
    INTO r
    FROM productos p LEFT JOIN formatos f ON f.id = p_formato AND f.producto_id = p.id
   WHERE p.id = p_producto;
  v_fab := r.fab; v_inst := r.inst;

  -- 2) volumen (tramo más alto alcanzado)
  SELECT t.precio_fabricacion AS fab, t.precio_instalacion AS inst INTO r
    FROM tarifas_volumen t
   WHERE t.producto_id = p_producto
     AND (t.formato_id IS NULL OR t.formato_id = p_formato)
     AND t.cantidad_desde <= p_cantidad
   ORDER BY (t.formato_id IS NOT NULL) DESC, t.cantidad_desde DESC
   LIMIT 1;
  IF FOUND THEN v_fab := COALESCE(r.fab, v_fab); v_inst := COALESCE(r.inst, v_inst); END IF;

  -- 3) tarifa por tipo de cliente y 4) tarifa del cliente (gana la más específica)
  SELECT t.precio_fabricacion AS fab, t.precio_instalacion AS inst INTO r
    FROM tarifas_cliente t
   WHERE t.producto_id = p_producto
     AND (t.formato_id IS NULL OR t.formato_id = p_formato)
     AND (t.cliente_id = p_cliente OR t.tipo_cliente = v_tipo)
     AND p_fecha >= t.vigente_desde AND (t.vigente_hasta IS NULL OR p_fecha <= t.vigente_hasta)
   ORDER BY (t.cliente_id IS NOT NULL) DESC, (t.formato_id IS NOT NULL) DESC, t.vigente_desde DESC
   LIMIT 1;
  IF FOUND THEN v_fab := COALESCE(r.fab, v_fab); v_inst := COALESCE(r.inst, v_inst); END IF;

  RETURN CASE p_alcance
           WHEN 'fabricacion'             THEN COALESCE(v_fab, 0)
           WHEN 'instalacion'             THEN COALESCE(v_inst, 0)
           ELSE COALESCE(v_fab, 0) + COALESCE(v_inst, 0)
         END;
END $$;

-- Cantidad facturable según la unidad del producto
CREATE OR REPLACE FUNCTION cantidad_facturable(
  p_unidad unidad_venta, p_piezas NUMERIC, p_ancho_cm NUMERIC, p_alto_cm NUMERIC,
  p_minimo_por_pieza NUMERIC DEFAULT NULL
) RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_unidad
    WHEN 'm2' THEN p_piezas * GREATEST(p_ancho_cm * p_alto_cm / 10000, COALESCE(p_minimo_por_pieza, 0))
    WHEN 'ml' THEN p_piezas * 2 * (p_ancho_cm + p_alto_cm) / 100
    ELSE p_piezas
  END
$$;

-- Vista práctica del catálogo para el buscador de la app
CREATE VIEW v_catalogo AS
SELECT c.nombre AS categoria, p.codigo AS cod_producto, p.nombre AS producto, p.unidad_venta,
       f.codigo AS cod_formato, f.nombre AS formato, f.ancho_cm, f.alto_cm, f.superficie_m2,
       COALESCE(f.precio_fabricacion, p.precio_fabricacion) AS precio_fabricacion,
       COALESCE(f.precio_instalacion, p.precio_instalacion) AS precio_instalacion,
       p.admite_medida_libre, f.alias
  FROM productos p
  JOIN categorias c ON c.id = p.categoria_id
  LEFT JOIN formatos f ON f.producto_id = p.id AND f.activo
 WHERE p.activo
 ORDER BY c.orden, p.codigo, f.ancho_cm NULLS FIRST;

-- Mantener actualizado_en
CREATE OR REPLACE FUNCTION tocar_actualizado() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.actualizado_en := now(); RETURN NEW; END $$;
CREATE TRIGGER trg_clientes_actualizado BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION tocar_actualizado();
