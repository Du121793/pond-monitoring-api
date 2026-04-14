BEGIN;

-- 天氣預測表
CREATE TABLE IF NOT EXISTS weather_pred (
  id                    BIGSERIAL PRIMARY KEY,
  
  -- 天氣數據
  avg_temperature       DOUBLE PRECISION,
  max_temperature       DOUBLE PRECISION,
  min_temperature       DOUBLE PRECISION,
  dew_point            DOUBLE PRECISION,
  relative_humidity    INTEGER CHECK (relative_humidity BETWEEN 0 AND 100),
  max_apparent_temperature DOUBLE PRECISION,
  min_apparent_temperature DOUBLE PRECISION,
  comfort_index_max    DOUBLE PRECISION,
  comfort_index_min    DOUBLE PRECISION,
  wind_speed           DOUBLE PRECISION,
  wind_direction       TEXT,
  precipitation_probability_12h INTEGER CHECK (precipitation_probability_12h BETWEEN 0 AND 100),
  weather_code         INTEGER,
  uv_index             INTEGER CHECK (uv_index BETWEEN 0 AND 15),
  
  -- 時間戳
  forecast_datetime    TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 歷史天氣表
CREATE TABLE IF NOT EXISTS weather_actual (
  id                    BIGSERIAL PRIMARY KEY,
  
  -- 天氣數據
  air_pressure         DOUBLE PRECISION,
  air_temperature      DOUBLE PRECISION,
  relative_humidity    INTEGER CHECK (relative_humidity BETWEEN 0 AND 100),
  wind_speed           DOUBLE PRECISION,
  wind_direction       TEXT,
  precipitation        DOUBLE PRECISION,
  
  -- 時間戳
  weather_datetime     TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_wp_forecast_datetime ON weather_pred (forecast_datetime);
CREATE INDEX IF NOT EXISTS idx_wa_weather_datetime ON weather_actual (weather_datetime);
CREATE INDEX IF NOT EXISTS idx_wp_created_at ON weather_pred (created_at);
CREATE INDEX IF NOT EXISTS idx_wa_created_at ON weather_actual (created_at);

-- 創建唯一約束（避免重複的天氣數據）
CREATE UNIQUE INDEX IF NOT EXISTS uq_wp_forecast_datetime ON weather_pred (forecast_datetime);
CREATE UNIQUE INDEX IF NOT EXISTS uq_wa_weather_datetime ON weather_actual (weather_datetime);

-- 更新時間戳觸發器
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 為兩個表創建觸發器
DO $$
BEGIN
  -- weather_pred 觸發器
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
  
  -- weather_actual 觸發器
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

COMMIT;
