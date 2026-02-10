BEGIN;

CREATE TABLE IF NOT EXISTS sensors (
  id                    BIGSERIAL PRIMARY KEY,
  pond_id               BIGINT NOT NULL,
  sensor_name           TEXT,
  local_ip              TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensors_pond_id ON sensors (pond_id);

CREATE TABLE IF NOT EXISTS sensor_data (
  id                    BIGSERIAL PRIMARY KEY,

  sensor_id             BIGINT NOT NULL REFERENCES sensors(id),
  fk_weather_actual_id  BIGINT,
  fk_weather_pred_id    BIGINT,

  ph                    DOUBLE PRECISION,
  turbidity_raw         INTEGER,
  turbidity_percent     DOUBLE PRECISION,
  turbidity_ntu         DOUBLE PRECISION,
  hardness              DOUBLE PRECISION,
  ec_us_cm              DOUBLE PRECISION,
  orp_mv                DOUBLE PRECISION,
  mq135                 INTEGER,
  mq137                 INTEGER,
  temp_deep             DOUBLE PRECISION,
  temp_shallow          DOUBLE PRECISION,

  rgb_r                 INTEGER CHECK (rgb_r BETWEEN 0 AND 255 OR rgb_r IS NULL),
  rgb_g                 INTEGER CHECK (rgb_g BETWEEN 0 AND 255 OR rgb_g IS NULL),
  rgb_b                 INTEGER CHECK (rgb_b BETWEEN 0 AND 255 OR rgb_b IS NULL),

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sd_sensor_created_at ON sensor_data (sensor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sd_fk_weather_actual ON sensor_data (fk_weather_actual_id);
CREATE INDEX IF NOT EXISTS idx_sd_fk_weather_pred   ON sensor_data (fk_weather_pred_id);

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class   c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at'
      AND c.relname = 'sensor_data'
      AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at
             BEFORE UPDATE ON sensor_data
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class   c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_sensors'
      AND c.relname = 'sensors'
      AND NOT t.tgisinternal
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_sensors
             BEFORE UPDATE ON sensors
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

COMMIT;

-- If a unique index is desired, enable this:
-- CREATE UNIQUE INDEX IF NOT EXISTS uq_sd_sensor_created_at
--   ON sensor_data (sensor_id, created_at);

-- Optional FK constraints:
-- ALTER TABLE sensors
--   ADD CONSTRAINT fk_sensors_pond FOREIGN KEY (pond_id)          REFERENCES ponds(id);
-- ALTER TABLE sensor_data
--   ADD CONSTRAINT fk_sd_wact  FOREIGN KEY (fk_weather_actual_id) REFERENCES weather_actual(id);
-- ALTER TABLE sensor_data
--   ADD CONSTRAINT fk_sd_wpred FOREIGN KEY (fk_weather_pred_id)   REFERENCES weather_pred(id);
