BEGIN;

-- 池塘基本資訊表
CREATE TABLE IF NOT EXISTS ponds (
  id                    BIGSERIAL PRIMARY KEY,
  
  -- 外鍵關聯
  user_id               BIGINT NOT NULL,
  
  -- 池塘基本資訊
  pond_name             TEXT NOT NULL,                                        -- 池塘名稱
  pond_length           DOUBLE PRECISION NOT NULL CHECK (pond_length > 0),  -- 池塘長度(公尺)
  pond_width            DOUBLE PRECISION NOT NULL CHECK (pond_width > 0),   -- 池塘寬度(公尺)
  pond_height           DOUBLE PRECISION NOT NULL CHECK (pond_height > 0),  -- 池塘高度(公尺)
  
  -- 魚類資訊
  total_fish_count      INTEGER NOT NULL DEFAULT 0 CHECK (total_fish_count >= 0),  -- 池塘總魚量
  total_fish_weight     DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (total_fish_weight >= 0),  -- 池塘魚總重(公斤)
  
  -- 餵食成長率
  feeding_growth_rate   DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (feeding_growth_rate >= 0 AND feeding_growth_rate <= 80),  -- 餵食成長率(最高80%)
  
  -- 時間戳
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 創建索引
CREATE INDEX IF NOT EXISTS idx_ponds_user_id ON ponds (user_id);
CREATE INDEX IF NOT EXISTS idx_ponds_created_at ON ponds (created_at);

-- 更新時間戳觸發器
CREATE OR REPLACE FUNCTION trg_set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$ LANGUAGE plpgsql;

-- 為 ponds 表創建觸發器
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

-- 之後若要補 FK：
-- ALTER TABLE ponds
--   ADD CONSTRAINT fk_ponds_user FOREIGN KEY (user_id) REFERENCES users(id);
