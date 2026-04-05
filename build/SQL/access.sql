BEGIN;

CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS access_keys (
  id                    BIGSERIAL PRIMARY KEY,
  user_id               BIGINT NOT NULL,
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

COMMIT;
