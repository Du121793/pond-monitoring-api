BEGIN;

-- 用戶基本資訊表
CREATE TABLE IF NOT EXISTS users (
  id                    BIGSERIAL PRIMARY KEY,
  
  -- 用戶基本資訊
  user_name             TEXT NOT NULL UNIQUE,
  password_hash         TEXT NOT NULL,
  
  -- 時間戳
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_login_at         TIMESTAMPTZ
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_users_user_name ON users (user_name);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users (created_at);
CREATE INDEX IF NOT EXISTS idx_users_last_login_at ON users (last_login_at);

-- 更新時間戳觸發器
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 為 users 表創建觸發器
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

COMMIT;
