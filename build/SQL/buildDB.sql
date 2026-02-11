BEGIN;

-- Drop existing tables
DROP TABLE IF EXISTS sensor_data CASCADE;
DROP TABLE IF EXISTS sensors CASCADE;
DROP TABLE IF EXISTS pond_daily_logs CASCADE;
DROP TABLE IF EXISTS ponds CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS weather_pred CASCADE;
DROP TABLE IF EXISTS weather_actual CASCADE;

-- Drop shared trigger function
DROP FUNCTION IF EXISTS trg_set_updated_at() CASCADE;

-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id                    BIGSERIAL PRIMARY KEY,
  user_name             TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_users_user_name ON users (user_name);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users (last_login_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_users' AND c.relname = 'users'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_users
             BEFORE UPDATE ON users
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Ponds
CREATE TABLE IF NOT EXISTS ponds (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               BIGINT NOT NULL,
  pond_name             TEXT NOT NULL,
  pond_length           DOUBLE PRECISION NOT NULL CHECK (pond_length > 0),
  pond_width            DOUBLE PRECISION NOT NULL CHECK (pond_width > 0),
  pond_height           DOUBLE PRECISION NOT NULL CHECK (pond_height > 0),
  total_fish_count      INTEGER NOT NULL DEFAULT 0 CHECK (total_fish_count >= 0),
  total_fish_weight     DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_fish_weight >= 0),
  feeding_growth_rate   DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (feeding_growth_rate >= 0 AND feeding_growth_rate <= 80),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponds_user_id ON ponds (user_id);
CREATE INDEX IF NOT EXISTS idx_ponds_created_at ON ponds (created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_ponds' AND c.relname = 'ponds'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_ponds
             BEFORE UPDATE ON ponds
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Sensors
CREATE TABLE IF NOT EXISTS sensors (
  id                    BIGSERIAL PRIMARY KEY,
  pond_id               BIGINT NOT NULL,
  sensor_name           TEXT,
  local_ip              TEXT,
  token_hash            TEXT,
  token_issued_at       TIMESTAMPTZ,
  token_revoked_at      TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sensors_pond_id ON sensors (pond_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_sensors' AND c.relname = 'sensors'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_sensors
             BEFORE UPDATE ON sensors
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Sensor Data
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

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_sensor_data' AND c.relname = 'sensor_data'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_sensor_data
             BEFORE UPDATE ON sensor_data
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Pond Daily Logs
CREATE TABLE IF NOT EXISTS pond_daily_logs (
  id                    BIGSERIAL PRIMARY KEY,
  pond_id               BIGINT NOT NULL,
  feeding_amount        DOUBLE PRECISION DEFAULT 0 CHECK (feeding_amount >= 0),
  death_count           INTEGER DEFAULT 0 CHECK (death_count >= 0),
  medication_given      BOOLEAN DEFAULT FALSE,
  medication_type       TEXT,
  notes                 TEXT,
  log_date              DATE NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pdl_pond_id ON pond_daily_logs (pond_id);
CREATE INDEX IF NOT EXISTS idx_pdl_log_date ON pond_daily_logs (log_date);
CREATE INDEX IF NOT EXISTS idx_pdl_created_at ON pond_daily_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_pdl_pond_date ON pond_daily_logs (pond_id, log_date);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_pond_daily_logs' AND c.relname = 'pond_daily_logs'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_pond_daily_logs
             BEFORE UPDATE ON pond_daily_logs
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Weather Prediction
CREATE TABLE IF NOT EXISTS weather_pred (
  id                    BIGSERIAL PRIMARY KEY,
  avg_temperature       DOUBLE PRECISION,
  max_temperature       DOUBLE PRECISION,
  min_temperature       DOUBLE PRECISION,
  dew_point             DOUBLE PRECISION,
  relative_humidity     INTEGER CHECK (relative_humidity BETWEEN 0 AND 100),
  max_apparent_temperature DOUBLE PRECISION,
  min_apparent_temperature DOUBLE PRECISION,
  comfort_index_max     DOUBLE PRECISION,
  comfort_index_min     DOUBLE PRECISION,
  wind_speed            DOUBLE PRECISION,
  wind_direction        TEXT,
  precipitation_probability_12h INTEGER CHECK (precipitation_probability_12h BETWEEN 0 AND 100),
  weather_code          INTEGER,
  uv_index              INTEGER CHECK (uv_index BETWEEN 0 AND 15),
  forecast_datetime     TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wp_forecast_datetime ON weather_pred (forecast_datetime);
CREATE INDEX IF NOT EXISTS idx_wp_created_at ON weather_pred (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wp_forecast_datetime ON weather_pred (forecast_datetime);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_wp' AND c.relname = 'weather_pred'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_wp
             BEFORE UPDATE ON weather_pred
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Weather Actual
CREATE TABLE IF NOT EXISTS weather_actual (
  id                    BIGSERIAL PRIMARY KEY,
  air_pressure          DOUBLE PRECISION,
  air_temperature       DOUBLE PRECISION,
  relative_humidity     INTEGER CHECK (relative_humidity BETWEEN 0 AND 100),
  wind_speed            DOUBLE PRECISION,
  wind_direction        TEXT,
  precipitation         DOUBLE PRECISION,
  weather_datetime      TIMESTAMPTZ NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_weather_datetime ON weather_actual (weather_datetime);
CREATE INDEX IF NOT EXISTS idx_wa_created_at ON weather_actual (created_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_weather_datetime ON weather_actual (weather_datetime);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_wa' AND c.relname = 'weather_actual'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_wa
             BEFORE UPDATE ON weather_actual
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

COMMIT;
