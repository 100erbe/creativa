-- =====================================================================
--  CREATIVA · Módulo DOCUMENTOS (PostgreSQL / Supabase)
--  Presupuestos · Albaranes · Facturas · Facturas rectificativas · Recibos/Cobros
--  Requiere: schema.sql (clientes y catálogo)
--  Versión 0.1 · 13/11/2026
-- =====================================================================

-- ---------------------------------------------------------------------
--  0. Tipos
-- ---------------------------------------------------------------------
CREATE TYPE tipo_documento AS ENUM (
  'presupuesto',    -- oferta al cliente (no fiscal)
  'albaran',        -- trabajo hecho pendiente de facturar (no fiscal)
  'factura',        -- factura ordinaria
  'rectificativa',  -- abono / factura rectificativa (serie propia)
  'recibo'          -- justificante de cobro
);

CREATE TYPE estado_documento AS ENUM (
  'borrador',   -- editable, sin número definitivo
  'emitido',    -- con número; si es factura ya NO se puede modificar
  'enviado',    -- enviado al cliente
  'aceptado',   -- presupuesto aceptado
  'rechazado',  -- presupuesto rechazado
  'caducado',   -- presupuesto vencido
  'facturado',  -- presupuesto/albarán convertido en factura
  'anulado'     -- anulado (una factura solo se anula mediante rectificativa)
);

CREATE TYPE metodo_cobro AS ENUM ('transferencia', 'efectivo', 'tarjeta', 'bizum', 'compensacion', 'otro');


-- ---------------------------------------------------------------------
--  1. Datos del emisor (Creativa) – una sola fila
-- ---------------------------------------------------------------------
CREATE TABLE empresa (
  id                SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nombre_comercial  TEXT NOT NULL,           -- 'CREATIVA Producciones'
  razon_social      TEXT NOT NULL,           -- titular fiscal
  nif               TEXT NOT NULL,
  direccion         TEXT NOT NULL,
  codigo_postal     TEXT,
  municipio         TEXT,
  provincia         TEXT,
  telefono          TEXT,
  movil             TEXT,
  email             TEXT,
  lema              TEXT,                    -- 'Técnicas y asesoría de producciones culturales'
  logo_url          TEXT,
  validez_presupuesto_dias INT NOT NULL DEFAULT 30
);


-- ---------------------------------------------------------------------
--  2. Series y numeración (correlativa y sin huecos, por serie y año)
-- ---------------------------------------------------------------------
CREATE TABLE series (
  id              SERIAL PRIMARY KEY,
  codigo          TEXT NOT NULL UNIQUE,      -- F, AB, P, ALB, REC
  tipo            tipo_documento NOT NULL,
  nombre          TEXT NOT NULL,
  prefijo         TEXT NOT NULL DEFAULT '',  -- 'Abono', 'P', 'REC'…
  digitos         INT  NOT NULL DEFAULT 4,
  sufijo_anual    BOOLEAN NOT NULL DEFAULT true,   -- añade '/26'
  por_defecto     BOOLEAN NOT NULL DEFAULT false,
  activa          BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX uq_serie_por_defecto ON series (tipo) WHERE por_defecto;

-- Último número usado por serie y año
CREATE TABLE contadores_serie (
  serie_id   INT NOT NULL REFERENCES series(id),
  anio       INT NOT NULL,
  ultimo     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (serie_id, anio)
);

CREATE OR REPLACE FUNCTION formatear_numero(p_serie INT, p_anio INT, p_numero INT)
RETURNS TEXT LANGUAGE sql STABLE AS $$
  SELECT s.prefijo || lpad(p_numero::text, s.digitos, '0')
         || CASE WHEN s.sufijo_anual THEN '/' || lpad((p_anio % 100)::text, 2, '0') ELSE '' END
    FROM series s WHERE s.id = p_serie
$$;


-- ---------------------------------------------------------------------
--  3. Documentos (cabecera)
-- ---------------------------------------------------------------------
CREATE TABLE documentos (
  id                    SERIAL PRIMARY KEY,
  tipo                  tipo_documento NOT NULL,
  serie_id              INT NOT NULL REFERENCES series(id),
  anio                  INT,                          -- año de numeración
  numero                INT,                          -- se asigna al emitir
  numero_completo       TEXT,                         -- '0139/26', 'Abono005'
  estado                estado_documento NOT NULL DEFAULT 'borrador',
  fecha                 DATE NOT NULL DEFAULT CURRENT_DATE,  -- fecha de expedición
  fecha_operacion       DATE,                         -- si distinta (fecha del servicio)
  fecha_vencimiento     DATE,
  valido_hasta          DATE,                         -- presupuestos

  -- Cliente + copia de sus datos fiscales en el momento de emitir (inmutable)
  cliente_id            INT NOT NULL REFERENCES clientes(id),
  cliente_razon_social  TEXT,
  cliente_documento     TEXT,
  cliente_direccion     TEXT,
  cliente_cp            TEXT,
  cliente_municipio     TEXT,
  cliente_provincia     TEXT,
  cliente_pais          CHAR(2),

  -- Contenido (igual que la hoja 'nuevo documento')
  campana               TEXT,                         -- 'artista/campaña'
  descripcion           TEXT,                         -- 'DESCRIPCIÓN:' de la factura
  campana_id            INT,                          -- FK al módulo Campañas (pendiente)

  -- Condiciones
  regimen_iva           regimen_iva NOT NULL DEFAULT 'general',
  motivo_exencion       TEXT,
  forma_pago_id         INT REFERENCES formas_pago(id),
  texto_forma_pago      TEXT,
  cuenta_cobro_id       INT REFERENCES cuentas_bancarias(id),
  iban_cobro            TEXT,                         -- copia del IBAN impreso

  -- Totales (los calcula la base de datos a partir de las líneas)
  descuento_global_pct  NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (descuento_global_pct BETWEEN 0 AND 100),
  suma_lineas           NUMERIC(12,2) NOT NULL DEFAULT 0,
  importe_descuento     NUMERIC(12,2) NOT NULL DEFAULT 0,
  base_imponible        NUMERIC(12,2) NOT NULL DEFAULT 0,
  cuota_iva             NUMERIC(12,2) NOT NULL DEFAULT 0,
  retencion_pct         NUMERIC(5,2)  NOT NULL DEFAULT 0,   -- IRPF si aplica
  importe_retencion     NUMERIC(12,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- Relaciones entre documentos
  documento_origen_id   INT REFERENCES documentos(id),     -- presupuesto→factura, factura→rectificativa
  motivo_rectificacion  TEXT,

  -- Envío, firma, archivo
  pdf_url               TEXT,
  firmado               BOOLEAN NOT NULL DEFAULT false,    -- firma FNMT
  enviado_en            TIMESTAMPTZ,
  enviado_a             TEXT,

  -- VeriFactu (registro de facturación AEAT) – se rellenará cuando se integre
  verifactu_huella      TEXT,
  verifactu_huella_anterior TEXT,
  verifactu_estado      TEXT,
  verifactu_qr          TEXT,

  notas_internas        TEXT,
  notas_cliente         TEXT,                   -- texto visible en el documento
  creado_por            UUID,                   -- usuario (auth.users en Supabase)
  creado_en             TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT numero_unico UNIQUE (serie_id, anio, numero),
  CONSTRAINT numerado_si_emitido CHECK (estado = 'borrador' OR numero IS NOT NULL),
  CONSTRAINT rectificativa_motivada CHECK (tipo <> 'rectificativa' OR motivo_rectificacion IS NOT NULL),
  CONSTRAINT exencion_motivada_doc CHECK (regimen_iva IN ('general','reducido') OR motivo_exencion IS NOT NULL)
);
CREATE INDEX idx_documentos_cliente ON documentos (cliente_id);
CREATE INDEX idx_documentos_fecha   ON documentos (tipo, fecha);
CREATE INDEX idx_documentos_origen  ON documentos (documento_origen_id);


-- ---------------------------------------------------------------------
--  4. Líneas
--     cantidad = piezas (ud, millar, mes, servicio, km)
--              = piezas × ancho × alto / 10.000, con mínimo por pieza (m²)
--              = piezas × perímetro (ml)
--     importe  = cantidad × (precio_unitario + recargo_acabados) × (1 − descuento)
-- ---------------------------------------------------------------------
CREATE TABLE lineas_documento (
  id                 SERIAL PRIMARY KEY,
  documento_id       INT NOT NULL REFERENCES documentos(id) ON DELETE CASCADE,
  orden              INT NOT NULL DEFAULT 1,
  producto_id        INT REFERENCES productos(id),
  formato_id         INT REFERENCES formatos(id),
  -- Copia del texto: la factura no cambia aunque cambie el catálogo
  articulo           TEXT,                          -- 'Descripción del artículo'
  descripcion        TEXT NOT NULL,                 -- 'Descripción'
  alcance            alcance_servicio NOT NULL DEFAULT 'fabricacion_instalacion',
  unidad             unidad_venta NOT NULL DEFAULT 'ud',
  piezas             NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (piezas <> 0),
  ancho_cm           NUMERIC(8,2),
  alto_cm            NUMERIC(8,2),
  minimo_por_pieza   NUMERIC(10,4),
  cantidad           NUMERIC(14,4) NOT NULL DEFAULT 1,  -- calculada por trigger
  precio_fabricacion NUMERIC(10,4),                     -- desglose informativo
  precio_instalacion NUMERIC(10,4),
  precio_unitario    NUMERIC(10,4) NOT NULL,            -- € por unidad (fab + inst según alcance)
  acabados           INT[],                             -- ids de acabados aplicados
  recargo_acabados   NUMERIC(10,4) NOT NULL DEFAULT 0,  -- € por unidad
  descuento_pct      NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (descuento_pct BETWEEN 0 AND 100),
  iva_pct            NUMERIC(5,2)  NOT NULL DEFAULT 21,
  importe            NUMERIC(12,2) NOT NULL DEFAULT 0,  -- calculado por trigger
  CONSTRAINT medidas_completas CHECK ((ancho_cm IS NULL) = (alto_cm IS NULL))
);
CREATE INDEX idx_lineas_documento ON lineas_documento (documento_id, orden);


-- ---------------------------------------------------------------------
--  5. Cobros (cada cobro puede generar un recibo)
-- ---------------------------------------------------------------------
CREATE TABLE cobros (
  id                 SERIAL PRIMARY KEY,
  documento_id       INT NOT NULL REFERENCES documentos(id),   -- factura o rectificativa
  fecha              DATE NOT NULL DEFAULT CURRENT_DATE,
  importe            NUMERIC(12,2) NOT NULL CHECK (importe <> 0),
  metodo             metodo_cobro NOT NULL DEFAULT 'transferencia',
  cuenta_bancaria_id INT REFERENCES cuentas_bancarias(id),
  referencia         TEXT,                                     -- concepto del extracto
  recibo_id          INT REFERENCES documentos(id),            -- recibo emitido (opcional)
  notas              TEXT,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cobros_documento ON cobros (documento_id);


-- ---------------------------------------------------------------------
--  6. Lógica
-- ---------------------------------------------------------------------

-- 6.1 Calcular cantidad e importe de cada línea
CREATE OR REPLACE FUNCTION calcular_linea() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.unidad IN ('m2','ml') AND NEW.ancho_cm IS NOT NULL THEN
    NEW.cantidad := cantidad_facturable(NEW.unidad, NEW.piezas, NEW.ancho_cm, NEW.alto_cm, NEW.minimo_por_pieza);
  ELSE
    NEW.cantidad := NEW.piezas;
  END IF;
  NEW.importe := round(NEW.cantidad * (NEW.precio_unitario + NEW.recargo_acabados)
                       * (1 - NEW.descuento_pct / 100), 2);
  RETURN NEW;
END $$;
CREATE TRIGGER trg_calcular_linea BEFORE INSERT OR UPDATE ON lineas_documento
  FOR EACH ROW EXECUTE FUNCTION calcular_linea();

-- 6.2 Recalcular totales de la cabecera
CREATE OR REPLACE FUNCTION recalcular_documento(p_doc INT) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d documentos%ROWTYPE; v_suma NUMERIC; v_iva NUMERIC;
BEGIN
  SELECT * INTO d FROM documentos WHERE id = p_doc;
  SELECT COALESCE(sum(importe), 0) INTO v_suma FROM lineas_documento WHERE documento_id = p_doc;
  -- IVA por tipo, redondeado por tipo (como exige el desglose de la factura)
  SELECT COALESCE(sum(round(b * iva / 100, 2)), 0) INTO v_iva
    FROM (SELECT l.iva_pct AS iva, sum(l.importe) * (1 - d.descuento_global_pct / 100) AS b
            FROM lineas_documento l WHERE l.documento_id = p_doc GROUP BY l.iva_pct) t;
  IF d.regimen_iva IN ('intracomunitario','exento') THEN v_iva := 0; END IF;
  UPDATE documentos SET
    suma_lineas       = v_suma,
    importe_descuento = round(v_suma * descuento_global_pct / 100, 2),
    base_imponible    = v_suma - round(v_suma * descuento_global_pct / 100, 2),
    cuota_iva         = v_iva,
    importe_retencion = round((v_suma - round(v_suma * descuento_global_pct / 100, 2)) * retencion_pct / 100, 2),
    total             = (v_suma - round(v_suma * descuento_global_pct / 100, 2)) + v_iva
                        - round((v_suma - round(v_suma * descuento_global_pct / 100, 2)) * retencion_pct / 100, 2)
  WHERE id = p_doc;
END $$;

CREATE OR REPLACE FUNCTION trg_lineas_recalcular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM recalcular_documento(COALESCE(NEW.documento_id, OLD.documento_id));
  IF TG_OP = 'UPDATE' AND NEW.documento_id <> OLD.documento_id THEN
    PERFORM recalcular_documento(OLD.documento_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_lineas_totales AFTER INSERT OR UPDATE OR DELETE ON lineas_documento
  FOR EACH ROW EXECUTE FUNCTION trg_lineas_recalcular();

-- Recalcular también si cambian descuento global, retención o régimen en un borrador
CREATE OR REPLACE FUNCTION trg_cabecera_recalcular() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.descuento_global_pct, NEW.retencion_pct, NEW.regimen_iva)
     IS DISTINCT FROM (OLD.descuento_global_pct, OLD.retencion_pct, OLD.regimen_iva) THEN
    PERFORM recalcular_documento(NEW.id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_documentos_totales AFTER UPDATE OF descuento_global_pct, retencion_pct, regimen_iva ON documentos
  FOR EACH ROW EXECUTE FUNCTION trg_cabecera_recalcular();

-- 6.3 Inmutabilidad de facturas emitidas (obligación legal)
CREATE OR REPLACE FUNCTION proteger_lineas() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v_estado estado_documento; v_tipo tipo_documento;
BEGIN
  SELECT estado, tipo INTO v_estado, v_tipo FROM documentos
   WHERE id = COALESCE(NEW.documento_id, OLD.documento_id);
  IF v_tipo IN ('factura','rectificativa') AND v_estado <> 'borrador' THEN
    RAISE EXCEPTION 'La factura ya está emitida: no se pueden modificar sus líneas. Emite una factura rectificativa.';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER trg_proteger_lineas BEFORE INSERT OR UPDATE OR DELETE ON lineas_documento
  FOR EACH ROW EXECUTE FUNCTION proteger_lineas();

CREATE OR REPLACE FUNCTION proteger_documento() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.tipo IN ('factura','rectificativa') AND OLD.estado <> 'borrador' THEN
      RAISE EXCEPTION 'No se puede borrar una factura emitida (%). Anúlala con una rectificativa.', OLD.numero_completo;
    END IF;
    RETURN OLD;
  END IF;
  NEW.actualizado_en := now();
  IF OLD.tipo IN ('factura','rectificativa') AND OLD.estado <> 'borrador' THEN
    IF (NEW.tipo, NEW.serie_id, NEW.anio, NEW.numero, NEW.fecha, NEW.cliente_id, NEW.cliente_razon_social,
        NEW.cliente_documento, NEW.base_imponible, NEW.cuota_iva, NEW.total, NEW.regimen_iva)
       IS DISTINCT FROM
       (OLD.tipo, OLD.serie_id, OLD.anio, OLD.numero, OLD.fecha, OLD.cliente_id, OLD.cliente_razon_social,
        OLD.cliente_documento, OLD.base_imponible, OLD.cuota_iva, OLD.total, OLD.regimen_iva) THEN
      RAISE EXCEPTION 'La factura % ya está emitida: sus datos fiscales no se pueden cambiar.', OLD.numero_completo;
    END IF;
    IF NEW.estado = 'borrador' THEN
      RAISE EXCEPTION 'Una factura emitida no puede volver a borrador.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_proteger_documento BEFORE UPDATE OR DELETE ON documentos
  FOR EACH ROW EXECUTE FUNCTION proteger_documento();

-- 6.4 Emitir: asigna número correlativo, congela datos del cliente y del cobro
CREATE OR REPLACE FUNCTION emitir_documento(p_doc INT, p_fecha DATE DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE d documentos%ROWTYPE; c clientes%ROWTYPE; v_anio INT; v_num INT; v_ult DATE;
BEGIN
  SELECT * INTO d FROM documentos WHERE id = p_doc FOR UPDATE;
  IF d.estado <> 'borrador' THEN RAISE EXCEPTION 'El documento ya está emitido (%)', d.numero_completo; END IF;
  IF NOT EXISTS (SELECT 1 FROM lineas_documento WHERE documento_id = p_doc) THEN
    RAISE EXCEPTION 'El documento no tiene líneas';
  END IF;
  d.fecha := COALESCE(p_fecha, d.fecha);
  v_anio := EXTRACT(YEAR FROM d.fecha);
  -- Las facturas de una serie deben ir en orden de fecha
  IF d.tipo IN ('factura','rectificativa') THEN
    SELECT max(fecha) INTO v_ult FROM documentos
     WHERE serie_id = d.serie_id AND anio = v_anio AND estado <> 'borrador';
    IF v_ult IS NOT NULL AND d.fecha < v_ult THEN
      RAISE EXCEPTION 'La fecha % es anterior a la última factura de la serie (%)', d.fecha, v_ult;
    END IF;
  END IF;
  INSERT INTO contadores_serie (serie_id, anio, ultimo) VALUES (d.serie_id, v_anio, 1)
  ON CONFLICT (serie_id, anio) DO UPDATE SET ultimo = contadores_serie.ultimo + 1
  RETURNING ultimo INTO v_num;

  SELECT * INTO c FROM clientes WHERE id = d.cliente_id;
  UPDATE documentos SET
    fecha = d.fecha, anio = v_anio, numero = v_num,
    numero_completo = formatear_numero(d.serie_id, v_anio, v_num),
    estado = 'emitido',
    cliente_razon_social = c.razon_social, cliente_documento = c.numero_documento,
    cliente_direccion = c.direccion, cliente_cp = c.codigo_postal, cliente_municipio = c.municipio,
    cliente_provincia = c.provincia, cliente_pais = c.pais,
    fecha_vencimiento = COALESCE(d.fecha_vencimiento,
        d.fecha + COALESCE((SELECT dias_vencimiento FROM formas_pago WHERE id = d.forma_pago_id), 0)),
    valido_hasta = CASE WHEN d.tipo = 'presupuesto'
        THEN COALESCE(d.valido_hasta, d.fecha + (SELECT validez_presupuesto_dias FROM empresa WHERE id = 1)) END,
    texto_forma_pago = COALESCE(d.texto_forma_pago, (SELECT texto_factura FROM formas_pago WHERE id = d.forma_pago_id)),
    iban_cobro = COALESCE(d.iban_cobro, (SELECT iban FROM cuentas_bancarias WHERE id = d.cuenta_cobro_id))
  WHERE id = p_doc;
  RETURN formatear_numero(d.serie_id, v_anio, v_num);
END $$;

-- 6.5 Crear un documento nuevo a partir de otro (presupuesto/albarán → factura, factura → rectificativa)
CREATE OR REPLACE FUNCTION convertir_documento(p_origen INT, p_tipo tipo_documento, p_motivo TEXT DEFAULT NULL)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE o documentos%ROWTYPE; v_nuevo INT; v_signo INT := 1;
BEGIN
  SELECT * INTO o FROM documentos WHERE id = p_origen;
  IF p_tipo = 'rectificativa' THEN
    IF o.tipo <> 'factura' OR o.estado = 'borrador' THEN
      RAISE EXCEPTION 'Solo se rectifican facturas emitidas';
    END IF;
    v_signo := -1;   -- por defecto, abono total (importes negativos)
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
  INSERT INTO lineas_documento (documento_id, orden, producto_id, formato_id, articulo, descripcion, alcance, unidad,
         piezas, ancho_cm, alto_cm, minimo_por_pieza, precio_fabricacion, precio_instalacion, precio_unitario,
         acabados, recargo_acabados, descuento_pct, iva_pct)
  SELECT v_nuevo, orden, producto_id, formato_id, articulo, descripcion, alcance, unidad,
         piezas * v_signo, ancho_cm, alto_cm, minimo_por_pieza, precio_fabricacion, precio_instalacion, precio_unitario,
         acabados, recargo_acabados, descuento_pct, iva_pct
    FROM lineas_documento WHERE documento_id = p_origen ORDER BY orden;
  IF o.tipo IN ('presupuesto','albaran') AND p_tipo = 'factura' THEN
    UPDATE documentos SET estado = 'facturado' WHERE id = p_origen;
  END IF;
  RETURN v_nuevo;
END $$;


-- ---------------------------------------------------------------------
--  7. Vistas
-- ---------------------------------------------------------------------

-- Estado de cobro de cada factura
CREATE VIEW v_estado_cobro AS
SELECT d.id, d.numero_completo, d.tipo, d.fecha, d.fecha_vencimiento, d.cliente_id, d.cliente_razon_social,
       d.total,
       COALESCE(sum(c.importe), 0)                AS cobrado,
       d.total - COALESCE(sum(c.importe), 0)      AS pendiente,
       CASE WHEN abs(d.total - COALESCE(sum(c.importe), 0)) < 0.01 THEN 'cobrada'
            WHEN COALESCE(sum(c.importe), 0) = 0 AND d.fecha_vencimiento < CURRENT_DATE THEN 'vencida'
            WHEN COALESCE(sum(c.importe), 0) = 0 THEN 'pendiente'
            ELSE 'parcial' END                    AS estado_cobro,
       max(c.fecha)                               AS ultimo_cobro
  FROM documentos d
  LEFT JOIN cobros c ON c.documento_id = d.id
 WHERE d.tipo IN ('factura','rectificativa') AND d.estado NOT IN ('borrador')
 GROUP BY d.id;

-- Libro registro de facturas expedidas (formato AEAT)
CREATE VIEW v_libro_registro AS
SELECT d.anio AS ejercicio,
       'T' || EXTRACT(QUARTER FROM d.fecha)::int AS periodo,
       d.fecha AS fecha_expedicion, COALESCE(d.fecha_operacion, d.fecha) AS fecha_operacion,
       s.codigo AS serie, d.numero_completo AS numero, d.tipo,
       d.cliente_documento AS nif_destinatario, d.cliente_razon_social AS destinatario,
       d.base_imponible, d.cuota_iva, d.importe_retencion, d.total,
       d.regimen_iva, d.motivo_exencion,
       o.numero_completo AS factura_rectificada,
       e.cobrado, e.pendiente, e.estado_cobro,
       d.descripcion
  FROM documentos d
  JOIN series s ON s.id = d.serie_id
  LEFT JOIN documentos o ON o.id = d.documento_origen_id AND d.tipo = 'rectificativa'
  LEFT JOIN v_estado_cobro e ON e.id = d.id
 WHERE d.tipo IN ('factura','rectificativa') AND d.estado <> 'borrador'
 ORDER BY d.fecha, s.codigo, d.numero;

-- Resumen trimestral de IVA repercutido (modelo 303)
CREATE VIEW v_resumen_iva_trimestral AS
SELECT d.anio AS ejercicio, EXTRACT(QUARTER FROM d.fecha)::int AS trimestre,
       l.iva_pct,
       round(sum(l.importe * (1 - d.descuento_global_pct / 100)), 2) AS base_imponible,
       round(sum(l.importe * (1 - d.descuento_global_pct / 100) *
                 CASE WHEN d.regimen_iva IN ('intracomunitario','exento') THEN 0 ELSE l.iva_pct END / 100), 2) AS cuota_iva,
       count(DISTINCT d.id) AS num_facturas
  FROM documentos d JOIN lineas_documento l ON l.documento_id = d.id
 WHERE d.tipo IN ('factura','rectificativa') AND d.estado NOT IN ('borrador','anulado')
 GROUP BY 1, 2, 3
 ORDER BY 1, 2, 3;

-- Presupuestos abiertos y albaranes sin facturar
CREATE VIEW v_pendiente_facturar AS
SELECT d.id, d.tipo, d.numero_completo, d.fecha, d.valido_hasta, d.cliente_id,
       COALESCE(d.cliente_razon_social, cl.razon_social) AS cliente, d.campana, d.base_imponible, d.total, d.estado
  FROM documentos d JOIN clientes cl ON cl.id = d.cliente_id
 WHERE (d.tipo = 'albaran' AND d.estado NOT IN ('facturado','anulado'))
    OR (d.tipo = 'presupuesto' AND d.estado IN ('emitido','enviado','aceptado'));
