BEGIN;

WITH default_options (category, name, default_unit) AS (
  VALUES
    ('feed_additive', '益生菌', 'g'),
    ('feed_additive', '維他命 C', 'g'),
    ('feed_additive', '綜合維生素', 'g'),
    ('feed_additive', '酵素', 'g'),
    ('feed_additive', '礦物質', 'g'),
    ('pond_medication', '石灰', 'kg'),
    ('pond_medication', '優碘', 'ml'),
    ('pond_medication', '二氧化氯', 'ml'),
    ('maintenance_material', '光合菌', 'ml'),
    ('maintenance_material', '水質改良劑', 'kg'),
    ('maintenance_material', '底質改良劑', 'kg')
)
INSERT INTO daily_log_option_catalog (
  category,
  name,
  default_unit,
  scope,
  user_id,
  is_active
)
SELECT
  d.category,
  d.name,
  d.default_unit,
  'global',
  NULL,
  TRUE
FROM default_options d
WHERE NOT EXISTS (
  SELECT 1
  FROM daily_log_option_catalog existing
  WHERE existing.scope = 'global'
    AND existing.category = d.category
    AND lower(existing.name) = lower(d.name)
);

COMMIT;
