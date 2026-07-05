BEGIN;

-- Drop existing tables
DROP TABLE IF EXISTS pond_risk_predictions CASCADE;
DROP TABLE IF EXISTS pond_forecast_predictions CASCADE;
DROP TABLE IF EXISTS sensor_crash_reports CASCADE;
DROP TABLE IF EXISTS sensor_maintenance_records CASCADE;
DROP TABLE IF EXISTS sensor_data CASCADE;
DROP TABLE IF EXISTS sensors CASCADE;
DROP TABLE IF EXISTS access_keys CASCADE;
DROP TABLE IF EXISTS notification_outbox CASCADE;
DROP TABLE IF EXISTS grafana_alert_events CASCADE;
DROP TABLE IF EXISTS push_subscriptions CASCADE;
DROP TABLE IF EXISTS daily_log_items CASCADE;
DROP TABLE IF EXISTS daily_log_option_catalog CASCADE;
DROP TABLE IF EXISTS pond_daily_logs CASCADE;
DROP TABLE IF EXISTS ponds CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS weather_pred CASCADE;
DROP TABLE IF EXISTS weather_actual CASCADE;
DROP TABLE IF EXISTS weather_observation_raw CASCADE;

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
  user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  pond_id               BIGINT NOT NULL REFERENCES ponds(id) ON DELETE CASCADE,
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

-- Access Keys
CREATE TABLE IF NOT EXISTS access_keys (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_hash           TEXT NOT NULL,
  access_preview        TEXT,
  pond_ids              BIGINT[] NOT NULL DEFAULT '{}',
  sensor_ids            BIGINT[] NOT NULL DEFAULT '{}',
  max_requests          INTEGER NOT NULL DEFAULT 200 CHECK (max_requests > 0),
  used_requests         INTEGER NOT NULL DEFAULT 0 CHECK (used_requests >= 0),
  expires_at            TIMESTAMPTZ NOT NULL,
  revoked_at            TIMESTAMPTZ,
  last_used_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_access_keys_hash ON access_keys (access_hash);
CREATE INDEX IF NOT EXISTS idx_access_keys_user_id ON access_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_access_keys_expires_at ON access_keys (expires_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_access_keys' AND c.relname = 'access_keys'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_access_keys
             BEFORE UPDATE ON access_keys
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint         TEXT NOT NULL UNIQUE,
  p256dh           TEXT NOT NULL,
  auth             TEXT NOT NULL,
  user_agent       TEXT,
  device_label     TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  failure_count    INTEGER NOT NULL DEFAULT 0,
  last_seen_at     TIMESTAMPTZ,
  last_failure_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON push_subscriptions (user_id)
  WHERE status = 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_push_subscriptions' AND c.relname = 'push_subscriptions'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_push_subscriptions
             BEFORE UPDATE ON push_subscriptions
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Grafana Alert Events
CREATE TABLE IF NOT EXISTS grafana_alert_events (
  id               BIGSERIAL PRIMARY KEY,
  source           TEXT NOT NULL DEFAULT 'grafana',
  rule_uid         TEXT,
  fingerprint      TEXT NOT NULL,
  status           TEXT NOT NULL,
  severity         TEXT,
  pond_id          BIGINT REFERENCES ponds(id) ON DELETE SET NULL,
  user_id          BIGINT REFERENCES users(id) ON DELETE SET NULL,
  labels           JSONB NOT NULL,
  annotations      JSONB,
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  last_enqueued_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  notify_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_grafana_alert_events_status
  ON grafana_alert_events (status);
CREATE INDEX IF NOT EXISTS idx_grafana_alert_events_user
  ON grafana_alert_events (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_grafana_alert_events' AND c.relname = 'grafana_alert_events'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_grafana_alert_events
             BEFORE UPDATE ON grafana_alert_events
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Notification Outbox
CREATE TABLE IF NOT EXISTS notification_outbox (
  id                BIGSERIAL PRIMARY KEY,
  event_id          BIGINT REFERENCES grafana_alert_events(id) ON DELETE SET NULL,
  user_id           BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  next_retry_at     TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON notification_outbox (next_retry_at)
  WHERE status = 'pending';

-- Sensor Data
CREATE TABLE IF NOT EXISTS sensor_data (
  id                    BIGSERIAL PRIMARY KEY,
  sensor_id             BIGINT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  fk_weather_actual_id  BIGINT,
  fk_weather_pred_id    BIGINT,
  ph                    DOUBLE PRECISION,
  turbidity_raw         INTEGER,
  turbidity_percent     DOUBLE PRECISION,
  turbidity_ntu         DOUBLE PRECISION,
  hardness              DOUBLE PRECISION,
  ec_us_cm              DOUBLE PRECISION,
  orp_mv                DOUBLE PRECISION,
  do_mg_l               DOUBLE PRECISION,
  do_sat                DOUBLE PRECISION,
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

CREATE TABLE IF NOT EXISTS sensor_maintenance_records (
  id                    BIGSERIAL PRIMARY KEY,
  sensor_id             BIGINT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  pond_id               BIGINT REFERENCES ponds(id) ON DELETE CASCADE,
  user_id               BIGINT REFERENCES users(id) ON DELETE CASCADE,
  local_ip              TEXT,
  calibration_start     TIMESTAMPTZ,
  calibration_time      TIMESTAMPTZ,
  reported_at           TIMESTAMPTZ,
  before_snapshot       JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot        JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_smr_sensor_created_at
  ON sensor_maintenance_records (sensor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smr_pond_created_at
  ON sensor_maintenance_records (pond_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_smr_user_created_at
  ON sensor_maintenance_records (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS sensor_crash_reports (
  id                    BIGSERIAL PRIMARY KEY,
  sensor_id             BIGINT NOT NULL REFERENCES sensors(id) ON DELETE CASCADE,
  pond_id               BIGINT REFERENCES ponds(id) ON DELETE CASCADE,
  user_id               BIGINT REFERENCES users(id) ON DELETE CASCADE,
  local_ip              TEXT,
  reported_at           TIMESTAMPTZ,
  msg_err               TEXT NOT NULL,
  log_text              TEXT,
  raw_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scr_sensor_created_at
  ON sensor_crash_reports (sensor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scr_pond_created_at
  ON sensor_crash_reports (pond_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scr_user_created_at
  ON sensor_crash_reports (user_id, created_at DESC);

-- Pond Daily Logs
CREATE TABLE IF NOT EXISTS pond_daily_logs (
  id                    BIGSERIAL PRIMARY KEY,
  pond_id               BIGINT NOT NULL REFERENCES ponds(id) ON DELETE CASCADE,
  feeding_amount        DOUBLE PRECISION DEFAULT 0 CHECK (feeding_amount >= 0),
  death_count           INTEGER DEFAULT 0 CHECK (death_count >= 0),
  notes                 TEXT,
  log_date              DATE NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pdl_pond_log_date
  ON pond_daily_logs (pond_id, log_date);
CREATE INDEX IF NOT EXISTS idx_pdl_pond_id ON pond_daily_logs (pond_id);
CREATE INDEX IF NOT EXISTS idx_pdl_log_date ON pond_daily_logs (log_date);
CREATE INDEX IF NOT EXISTS idx_pdl_created_at ON pond_daily_logs (created_at);

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

ALTER TABLE sensor_data
  DROP CONSTRAINT IF EXISTS fk_sensor_data_weather_actual;

ALTER TABLE sensor_data
  ADD CONSTRAINT fk_sensor_data_weather_actual
  FOREIGN KEY (fk_weather_actual_id)
  REFERENCES weather_actual(id)
  ON DELETE SET NULL;

ALTER TABLE sensor_data
  DROP CONSTRAINT IF EXISTS fk_sensor_data_weather_pred;

ALTER TABLE sensor_data
  ADD CONSTRAINT fk_sensor_data_weather_pred
  FOREIGN KEY (fk_weather_pred_id)
  REFERENCES weather_pred(id)
  ON DELETE SET NULL;

-- Daily Log Option Catalog
CREATE TABLE IF NOT EXISTS daily_log_option_catalog (
  id           BIGSERIAL PRIMARY KEY,
  category     TEXT NOT NULL CHECK (
    category IN ('feed_additive', 'pond_medication', 'maintenance_material')
  ),
  name         TEXT NOT NULL,
  default_unit TEXT,
  scope        TEXT NOT NULL CHECK (scope IN ('global', 'user')),
  user_id      BIGINT REFERENCES users(id) ON DELETE CASCADE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_daily_log_option_scope_user
    CHECK (
      (scope = 'global' AND user_id IS NULL) OR
      (scope = 'user' AND user_id IS NOT NULL)
    )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_log_option_global_name
  ON daily_log_option_catalog (category, lower(name))
  WHERE scope = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_log_option_user_name
  ON daily_log_option_catalog (user_id, category, lower(name))
  WHERE scope = 'user';
CREATE INDEX IF NOT EXISTS idx_daily_log_option_user_category
  ON daily_log_option_catalog (user_id, category);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_daily_log_option_catalog'
      AND c.relname = 'daily_log_option_catalog'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_daily_log_option_catalog
             BEFORE UPDATE ON daily_log_option_catalog
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Daily Log Items
CREATE TABLE IF NOT EXISTS daily_log_items (
  id                 BIGSERIAL PRIMARY KEY,
  daily_log_id       BIGINT NOT NULL REFERENCES pond_daily_logs(id) ON DELETE CASCADE,
  catalog_id         BIGINT REFERENCES daily_log_option_catalog(id) ON DELETE SET NULL,
  item_name_snapshot TEXT NOT NULL,
  category           TEXT NOT NULL CHECK (
    category IN ('feed_additive', 'pond_medication', 'maintenance_material')
  ),
  dosage             NUMERIC(14, 4),
  unit               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_daily_log_items_dosage_non_negative
    CHECK (dosage IS NULL OR dosage >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_log_item_per_log_name
  ON daily_log_items (daily_log_id, category, lower(item_name_snapshot));
CREATE INDEX IF NOT EXISTS idx_daily_log_items_daily_log_id
  ON daily_log_items (daily_log_id);
CREATE INDEX IF NOT EXISTS idx_daily_log_items_catalog_id
  ON daily_log_items (catalog_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_daily_log_items' AND c.relname = 'daily_log_items'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_daily_log_items
             BEFORE UPDATE ON daily_log_items
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Raw weather observations
CREATE TABLE IF NOT EXISTS weather_observation_raw (
  id                    BIGSERIAL PRIMARY KEY,
  station_id            TEXT NOT NULL,
  station_name          TEXT,
  dataset_id            TEXT NOT NULL,
  observed_at           TIMESTAMPTZ NOT NULL,
  fetched_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  source_payload        JSONB NOT NULL,
  weather               TEXT,
  county_name           TEXT,
  town_name             TEXT,
  station_latitude      DOUBLE PRECISION,
  station_longitude     DOUBLE PRECISION,
  station_altitude      DOUBLE PRECISION,
  air_pressure          DOUBLE PRECISION,
  air_temperature       DOUBLE PRECISION,
  relative_humidity     DOUBLE PRECISION CHECK (relative_humidity IS NULL OR relative_humidity BETWEEN 0 AND 100),
  wind_speed            DOUBLE PRECISION,
  wind_direction        DOUBLE PRECISION,
  precipitation         DOUBLE PRECISION,
  precipitation_10min   DOUBLE PRECISION,
  precipitation_1hr     DOUBLE PRECISION,
  precipitation_3hr     DOUBLE PRECISION,
  precipitation_6hr     DOUBLE PRECISION,
  precipitation_12hr    DOUBLE PRECISION,
  precipitation_24hr    DOUBLE PRECISION,
  precipitation_2days   DOUBLE PRECISION,
  precipitation_3days   DOUBLE PRECISION,
  sunshine_duration     DOUBLE PRECISION,
  solar_radiation       DOUBLE PRECISION,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_weather_observation_raw UNIQUE (station_id, dataset_id, observed_at)
);

CREATE INDEX IF NOT EXISTS idx_wor_station_observed_at
ON weather_observation_raw (station_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_wor_dataset_observed_at
ON weather_observation_raw (dataset_id, observed_at DESC);

CREATE INDEX IF NOT EXISTS idx_wor_source_payload
ON weather_observation_raw USING GIN (source_payload);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_wor' AND c.relname = 'weather_observation_raw'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_wor
             BEFORE UPDATE ON weather_observation_raw
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;


-- Forecast Predictions
CREATE TABLE IF NOT EXISTS pond_forecast_predictions (
  id                    BIGSERIAL PRIMARY KEY,
  pond_id               BIGINT NOT NULL REFERENCES ponds(id) ON DELETE CASCADE,
  prediction_ts         TIMESTAMPTZ NOT NULL,
  source_feature_ts     TIMESTAMPTZ,
  forecast_for_ts       TIMESTAMPTZ NOT NULL,
  horizon_hours         INTEGER NOT NULL DEFAULT 6 CHECK (horizon_hours > 0),
  metric_name           TEXT NOT NULL,
  current_value         DOUBLE PRECISION,
  predicted_value       DOUBLE PRECISION NOT NULL,
  delta_value           DOUBLE PRECISION,
  model_family          TEXT NOT NULL,
  model_version         TEXT NOT NULL,
  source_service        TEXT NOT NULL DEFAULT 'model-response-service',
  raw_payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pond_forecast_predictions UNIQUE (pond_id, prediction_ts, metric_name, horizon_hours)
);

CREATE INDEX IF NOT EXISTS idx_pfp_pond_prediction_ts
  ON pond_forecast_predictions (pond_id, prediction_ts DESC);
CREATE INDEX IF NOT EXISTS idx_pfp_pond_forecast_for_ts
  ON pond_forecast_predictions (pond_id, forecast_for_ts DESC);
CREATE INDEX IF NOT EXISTS idx_pfp_metric_forecast_for_ts
  ON pond_forecast_predictions (metric_name, forecast_for_ts DESC);
CREATE INDEX IF NOT EXISTS idx_pfp_model_version
  ON pond_forecast_predictions (model_version);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_pond_forecast_predictions'
      AND c.relname = 'pond_forecast_predictions'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_pond_forecast_predictions
             BEFORE UPDATE ON pond_forecast_predictions
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Risk Predictions
CREATE TABLE IF NOT EXISTS pond_risk_predictions (
  id                           BIGSERIAL PRIMARY KEY,
  pond_id                      BIGINT NOT NULL REFERENCES ponds(id) ON DELETE CASCADE,
  prediction_ts                TIMESTAMPTZ NOT NULL,
  source_feature_ts            TIMESTAMPTZ,
  risk_for_date                DATE NOT NULL,
  risk_type                    TEXT NOT NULL CHECK (risk_type IN ('risk_flag', 'risk_score')),
  risk_probability             DOUBLE PRECISION,
  risk_score                   DOUBLE PRECISION,
  risk_flag                    INTEGER CHECK (risk_flag IN (0, 1) OR risk_flag IS NULL),
  risk_level                   TEXT,
  predicted_next_day_death_count DOUBLE PRECISION,
  model_family                 TEXT NOT NULL,
  model_version                TEXT NOT NULL,
  source_service               TEXT NOT NULL DEFAULT 'model-response-service',
  raw_payload                  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_pond_risk_predictions UNIQUE (pond_id, prediction_ts, risk_type)
);

CREATE INDEX IF NOT EXISTS idx_prp_pond_prediction_ts
  ON pond_risk_predictions (pond_id, prediction_ts DESC);
CREATE INDEX IF NOT EXISTS idx_prp_pond_risk_for_date
  ON pond_risk_predictions (pond_id, risk_for_date DESC);
CREATE INDEX IF NOT EXISTS idx_prp_risk_type_date
  ON pond_risk_predictions (risk_type, risk_for_date DESC);
CREATE INDEX IF NOT EXISTS idx_prp_model_version
  ON pond_risk_predictions (model_version);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_pond_risk_predictions'
      AND c.relname = 'pond_risk_predictions'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_pond_risk_predictions
             BEFORE UPDATE ON pond_risk_predictions
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

COMMIT;
