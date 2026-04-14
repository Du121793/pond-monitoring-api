BEGIN;

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

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

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
