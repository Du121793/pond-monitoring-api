BEGIN;

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS ponds (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pond_name             TEXT NOT NULL,
  pond_length           DOUBLE PRECISION NOT NULL CHECK (pond_length > 0),
  pond_width            DOUBLE PRECISION NOT NULL CHECK (pond_width > 0),
  pond_height           DOUBLE PRECISION NOT NULL CHECK (pond_height > 0),
  total_fish_count      INTEGER NOT NULL DEFAULT 0 CHECK (total_fish_count >= 0),
  total_fish_weight     DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_fish_weight >= 0),
  feeding_growth_rate   DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (
    feeding_growth_rate >= 0 AND feeding_growth_rate <= 80
  ),
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

COMMIT;
