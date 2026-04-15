import { pool_RW, pool_RO } from "./db_connect.js";

const VALID_CATEGORIES = new Set([
  "feed_additive",
  "pond_medication",
  "maintenance_material",
]);

export const DAILY_LOG_ERRORS = {
  DUPLICATE: "DAILY_LOG_DUPLICATE",
  NOT_FOUND: "DAILY_LOG_NOT_FOUND",
  INVALID_CATEGORY: "DAILY_LOG_ITEM_INVALID_CATEGORY",
  CATEGORY_MISMATCH: "DAILY_LOG_ITEM_CATEGORY_MISMATCH",
  INVALID_DOSAGE: "DAILY_LOG_ITEM_INVALID_DOSAGE",
  ITEM_NAME_REQUIRED: "DAILY_LOG_ITEM_NAME_REQUIRED",
  CATALOG_NOT_FOUND: "DAILY_LOG_ITEM_CATALOG_NOT_FOUND",
  INVALID_CATALOG_ID: "DAILY_LOG_ITEM_INVALID_CATALOG_ID",
  OPTION_NAME_REQUIRED: "DAILY_LOG_OPTION_NAME_REQUIRED",
  OPTION_INVALID_CATEGORY: "DAILY_LOG_OPTION_INVALID_CATEGORY",
  OPTION_NOT_FOUND: "DAILY_LOG_OPTION_NOT_FOUND",
};

const selectDailyLogColumns = `
  pdl.id,
  pdl.pond_id,
  pdl.feeding_amount,
  pdl.death_count,
  pdl.notes,
  pdl.log_date,
  pdl.created_at,
  pdl.updated_at,
  COALESCE((
    SELECT json_agg(
      json_build_object(
        'id', dli.id,
        'catalog_id', dli.catalog_id,
        'item_name_snapshot', dli.item_name_snapshot,
        'category', dli.category,
        'dosage', dli.dosage,
        'unit', dli.unit,
        'created_at', dli.created_at,
        'updated_at', dli.updated_at
      )
      ORDER BY dli.id ASC
    )
    FROM daily_log_items dli
    WHERE dli.daily_log_id = pdl.id
  ), '[]'::json) AS items
`;

const trimText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).replace(/\s+/g, " ").trim();
  return normalized || null;
};

const toPositiveInteger = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(DAILY_LOG_ERRORS.INVALID_CATALOG_ID);
  }
  return parsed;
};

const toNullableDosage = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(DAILY_LOG_ERRORS.INVALID_DOSAGE);
  }
  return parsed;
};

const normalizeRawItems = (data) => {
  if (Array.isArray(data.items)) {
    return data.items;
  }

  const legacyMedicationType = trimText(data.medication_type);
  if (!legacyMedicationType) {
    return [];
  }

  return [
    {
      category: "pond_medication",
      item_name_snapshot: legacyMedicationType,
      dosage: null,
      unit: null,
    },
  ];
};

const loadAccessibleCatalogMap = async (client, userId, catalogIds) => {
  if (catalogIds.length === 0) {
    return new Map();
  }

  const { rows } = await client.query(
    `
      SELECT id, category, name, default_unit
      FROM daily_log_option_catalog
      WHERE id = ANY($1::bigint[])
        AND is_active = TRUE
        AND (scope = 'global' OR user_id = $2)
    `,
    [catalogIds, userId]
  );

  return new Map(rows.map((row) => [Number(row.id), row]));
};

const prepareDailyLogItems = async (client, userId, data) => {
  const rawItems = normalizeRawItems(data);
  const normalized = rawItems.map((item) => ({
    category: trimText(item.category),
    catalogId: toPositiveInteger(item.catalog_id),
    itemNameSnapshot: trimText(
      item.item_name_snapshot ?? item.name ?? item.item_name
    ),
    dosage: toNullableDosage(item.dosage),
    unit: trimText(item.unit),
  }));

  const catalogIds = normalized
    .map((item) => item.catalogId)
    .filter((value) => value !== null);
  const catalogMap = await loadAccessibleCatalogMap(client, userId, catalogIds);

  return normalized.map((item) => {
    const catalog = item.catalogId ? catalogMap.get(item.catalogId) : null;

    if (item.catalogId && !catalog) {
      throw new Error(DAILY_LOG_ERRORS.CATALOG_NOT_FOUND);
    }

    const category = item.category || catalog?.category || null;
    if (!category || !VALID_CATEGORIES.has(category)) {
      throw new Error(DAILY_LOG_ERRORS.INVALID_CATEGORY);
    }

    if (catalog && category !== catalog.category) {
      throw new Error(DAILY_LOG_ERRORS.CATEGORY_MISMATCH);
    }

    const itemNameSnapshot = item.itemNameSnapshot || trimText(catalog?.name);
    if (!itemNameSnapshot) {
      throw new Error(DAILY_LOG_ERRORS.ITEM_NAME_REQUIRED);
    }

    return {
      category,
      catalogId: item.catalogId,
      itemNameSnapshot,
      dosage: item.dosage,
      unit: item.unit || trimText(catalog?.default_unit),
    };
  });
};

const insertDailyLogItems = async (client, dailyLogId, items) => {
  for (const item of items) {
    await client.query(
      `
        INSERT INTO daily_log_items (
          daily_log_id,
          catalog_id,
          item_name_snapshot,
          category,
          dosage,
          unit
        ) VALUES (
          $1, $2, $3, $4, $5, $6
        )
      `,
      [
        dailyLogId,
        item.catalogId,
        item.itemNameSnapshot,
        item.category,
        item.dosage,
        item.unit,
      ]
    );
  }
};

const getDailyLogByIdWithClient = async (client, logId, pondId) => {
  const { rows } = await client.query(
    `
      SELECT ${selectDailyLogColumns}
      FROM pond_daily_logs pdl
      WHERE pdl.id = $1 AND pdl.pond_id = $2
      LIMIT 1
    `,
    [logId, pondId]
  );

  return rows[0] || null;
};

export const getPoolRW = () => pool_RW;

export const getTodayDailyLog = async (pondId) => {
  const { rows } = await pool_RO.query(
    `
      SELECT ${selectDailyLogColumns}
      FROM pond_daily_logs pdl
      WHERE pdl.pond_id = $1
        AND pdl.log_date = CURRENT_DATE
      ORDER BY pdl.created_at DESC
      LIMIT 1
    `,
    [pondId]
  );

  return rows[0] || null;
};

export const getDailyLogById = async (logId, pondId) => {
  return getDailyLogByIdWithClient(pool_RO, logId, pondId);
};

export const getPondsMissingDailyLog = async (targetDate) => {
  const query = `
    SELECT
      p.id AS pond_id,
      p.user_id,
      p.pond_name
    FROM ponds p
    LEFT JOIN pond_daily_logs pdl
      ON pdl.pond_id = p.id
     AND pdl.log_date = $1::date
    WHERE pdl.id IS NULL
    ORDER BY p.id ASC
  `;
  const { rows } = await pool_RO.query(query, [targetDate]);
  return rows;
};

export const getPondDailyLogs = async (
  pondId,
  { limit = 30, offset = 0, start_date, end_date } = {}
) => {
  const limitNum = Math.max(1, Math.min(Number(limit) || 30, 200));
  const offsetNum = Math.max(0, Number(offset) || 0);

  const where = ["pdl.pond_id = $1"];
  const values = [pondId];

  if (start_date) {
    values.push(start_date);
    where.push(`pdl.log_date >= $${values.length}`);
  }
  if (end_date) {
    values.push(end_date);
    where.push(`pdl.log_date <= $${values.length}`);
  }

  const whereSql = where.join(" AND ");

  const totalQuery = `
    SELECT COUNT(*)::int AS total
    FROM pond_daily_logs pdl
    WHERE ${whereSql}
  `;
  const totalResult = await pool_RO.query(totalQuery, values);
  const total = totalResult.rows[0]?.total || 0;

  const logsQuery = `
    SELECT ${selectDailyLogColumns}
    FROM pond_daily_logs pdl
    WHERE ${whereSql}
    ORDER BY pdl.log_date DESC, pdl.created_at DESC
    LIMIT $${values.length + 1}
    OFFSET $${values.length + 2}
  `;
  const logsValues = [...values, limitNum, offsetNum];
  const logsResult = await pool_RO.query(logsQuery, logsValues);
  const logs = logsResult.rows;

  return {
    logs,
    count: logs.length,
    total,
    pagination: {
      limit: limitNum,
      offset: offsetNum,
      total,
      hasMore: offsetNum + logs.length < total,
    },
  };
};

export const createDailyLog = async (pondId, userId, data) => {
  const client = await pool_RW.connect();

  try {
    await client.query("BEGIN");

    const duplicateCheck = await client.query(
      `
        SELECT 1
        FROM pond_daily_logs
        WHERE pond_id = $1 AND log_date = $2
        LIMIT 1
      `,
      [pondId, data.log_date]
    );

    if (duplicateCheck.rows.length > 0) {
      throw new Error(DAILY_LOG_ERRORS.DUPLICATE);
    }

    const preparedItems = await prepareDailyLogItems(client, userId, data);

    const insertResult = await client.query(
      `
        INSERT INTO pond_daily_logs (
          pond_id,
          feeding_amount,
          death_count,
          notes,
          log_date
        ) VALUES (
          $1, $2, $3, $4, $5
        )
        RETURNING id
      `,
      [
        pondId,
        data.feeding_amount ?? 0,
        data.death_count ?? 0,
        data.notes ?? null,
        data.log_date,
      ]
    );

    const logId = insertResult.rows[0].id;
    await insertDailyLogItems(client, logId, preparedItems);

    const created = await getDailyLogByIdWithClient(client, logId, pondId);
    await client.query("COMMIT");
    return created;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const updateDailyLog = async (logId, pondId, userId, data) => {
  const client = await pool_RW.connect();

  try {
    await client.query("BEGIN");

    const existing = await getDailyLogByIdWithClient(client, logId, pondId);
    if (!existing) {
      throw new Error(DAILY_LOG_ERRORS.NOT_FOUND);
    }

    const targetLogDate = data.log_date ?? existing.log_date;
    if (data.log_date) {
      const duplicateCheck = await client.query(
        `
          SELECT 1
          FROM pond_daily_logs
          WHERE pond_id = $1
            AND log_date = $2
            AND id <> $3
          LIMIT 1
        `,
        [pondId, data.log_date, logId]
      );

      if (duplicateCheck.rows.length > 0) {
        throw new Error(DAILY_LOG_ERRORS.DUPLICATE);
      }
    }

    await client.query(
      `
        UPDATE pond_daily_logs
        SET feeding_amount = $1,
            death_count = $2,
            notes = $3,
            log_date = $4,
            updated_at = now()
        WHERE id = $5 AND pond_id = $6
      `,
      [
        data.feeding_amount ?? existing.feeding_amount,
        data.death_count ?? existing.death_count,
        data.notes === undefined ? existing.notes : data.notes,
        targetLogDate,
        logId,
        pondId,
      ]
    );

    if (data.items !== undefined || data.medication_type !== undefined) {
      const preparedItems = await prepareDailyLogItems(client, userId, data);
      await client.query(`DELETE FROM daily_log_items WHERE daily_log_id = $1`, [
        logId,
      ]);
      await insertDailyLogItems(client, logId, preparedItems);
    }

    const updated = await getDailyLogByIdWithClient(client, logId, pondId);
    await client.query("COMMIT");
    return updated;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const deleteDailyLog = async (logId, pondId) => {
  const query = `
    DELETE FROM pond_daily_logs
    WHERE id = $1 AND pond_id = $2
    RETURNING id
  `;
  const { rows } = await pool_RW.query(query, [logId, pondId]);
  return rows.length > 0;
};

export const getDailyLogOptions = async (userId, { category } = {}) => {
  const values = [userId];
  const where = [`(scope = 'global' OR user_id = $1)`];

  if (category) {
    if (!VALID_CATEGORIES.has(category)) {
      throw new Error(DAILY_LOG_ERRORS.OPTION_INVALID_CATEGORY);
    }
    values.push(category);
    where.push(`category = $${values.length}`);
  }

  const { rows } = await pool_RO.query(
    `
      SELECT
        id,
        category,
        name,
        default_unit,
        scope,
        user_id,
        is_active,
        created_at,
        updated_at
      FROM daily_log_option_catalog
      WHERE ${where.join(" AND ")}
      ORDER BY
        CASE WHEN scope = 'global' THEN 0 ELSE 1 END,
        category ASC,
        lower(name) ASC
    `,
    values
  );

  return rows;
};

export const createDailyLogOption = async (
  userId,
  { category, name, default_unit }
) => {
  const normalizedCategory = trimText(category);
  const normalizedName = trimText(name);
  const normalizedUnit = trimText(default_unit);

  if (!normalizedName) {
    throw new Error(DAILY_LOG_ERRORS.OPTION_NAME_REQUIRED);
  }
  if (!VALID_CATEGORIES.has(normalizedCategory)) {
    throw new Error(DAILY_LOG_ERRORS.OPTION_INVALID_CATEGORY);
  }

  const { rows } = await pool_RW.query(
    `
      INSERT INTO daily_log_option_catalog (
        category,
        name,
        default_unit,
        scope,
        user_id,
        is_active
      ) VALUES (
        $1, $2, $3, 'user', $4, TRUE
      )
      RETURNING *
    `,
    [normalizedCategory, normalizedName, normalizedUnit, userId]
  );

  return rows[0];
};

export const updateDailyLogOption = async (
  userId,
  optionId,
  { name, default_unit, is_active }
) => {
  const values = [];
  const setClauses = [];
  let index = 1;

  if (name !== undefined) {
    const normalizedName = trimText(name);
    if (!normalizedName) {
      throw new Error(DAILY_LOG_ERRORS.OPTION_NAME_REQUIRED);
    }
    values.push(normalizedName);
    setClauses.push(`name = $${index++}`);
  }

  if (default_unit !== undefined) {
    values.push(trimText(default_unit));
    setClauses.push(`default_unit = $${index++}`);
  }

  if (is_active !== undefined) {
    values.push(Boolean(is_active));
    setClauses.push(`is_active = $${index++}`);
  }

  if (setClauses.length === 0) {
    const { rows } = await pool_RO.query(
      `
        SELECT *
        FROM daily_log_option_catalog
        WHERE id = $1 AND scope = 'user' AND user_id = $2
      `,
      [optionId, userId]
    );

    if (!rows[0]) {
      throw new Error(DAILY_LOG_ERRORS.OPTION_NOT_FOUND);
    }
    return rows[0];
  }

  values.push(optionId, userId);

  const { rows } = await pool_RW.query(
    `
      UPDATE daily_log_option_catalog
      SET ${setClauses.join(", ")}, updated_at = now()
      WHERE id = $${index++}
        AND scope = 'user'
        AND user_id = $${index++}
      RETURNING *
    `,
    values
  );

  if (!rows[0]) {
    throw new Error(DAILY_LOG_ERRORS.OPTION_NOT_FOUND);
  }

  return rows[0];
};
