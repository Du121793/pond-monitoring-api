BEGIN;

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

COMMIT;
