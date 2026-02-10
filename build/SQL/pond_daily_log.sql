BEGIN;

-- 池塘日常修改記錄表
CREATE TABLE IF NOT EXISTS pond_daily_logs (
  id                    BIGSERIAL PRIMARY KEY,
  
  -- 外鍵關聯
  pond_id               BIGINT NOT NULL,
  
  -- 日常修改記錄
  feeding_amount        DOUBLE PRECISION DEFAULT 0 CHECK (feeding_amount >= 0),  -- 餵養量(公斤)
  death_count           INTEGER DEFAULT 0 CHECK (death_count >= 0),              -- 死亡數
  medication_given      BOOLEAN DEFAULT FALSE,                                    -- 是否投藥
  medication_type       TEXT,                                                     -- 投藥種類
  notes                 TEXT,                                                     -- 其他註記
  
  -- 修改日期
  log_date              DATE NOT NULL,                                            -- 做修改的日期
  
  -- 時間戳
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_pdl_pond_id ON pond_daily_logs (pond_id);
CREATE INDEX IF NOT EXISTS idx_pdl_log_date ON pond_daily_logs (log_date);
CREATE INDEX IF NOT EXISTS idx_pdl_created_at ON pond_daily_logs (created_at);
CREATE INDEX IF NOT EXISTS idx_pdl_pond_date ON pond_daily_logs (pond_id, log_date);

-- 更新時間戳觸發器
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 為 pond_daily_logs 表創建觸發器
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

COMMIT;

-- 之後若要補 FK：
-- ALTER TABLE pond_daily_logs
--   ADD CONSTRAINT fk_pdl_pond FOREIGN KEY (pond_id) REFERENCES ponds(id);
