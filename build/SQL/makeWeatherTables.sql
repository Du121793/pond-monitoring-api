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

COMMIT;
