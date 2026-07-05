BEGIN;

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

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
