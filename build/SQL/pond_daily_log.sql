BEGIN;

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

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

COMMIT;
