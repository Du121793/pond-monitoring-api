import { pool_RW, pool_RO } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";
import { removeAccessScopeReferences } from "./access_keys.js";

export const getUserPonds = async (userId) => {
  const query = `
    SELECT *
    FROM ponds
    WHERE user_id = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await pool_RO.query(query, [userId]);
  return rows;
};

export const getPondOwnerId = async (pondId) => {
  const query = `
    SELECT user_id
    FROM ponds
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool_RO.query(query, [pondId]);
  return rows[0]?.user_id ?? null;
};

export const checkPondOwnership = async (pondId, userId) => {
  const query = `
    SELECT 1
    FROM ponds
    WHERE id = $1 AND user_id = $2
    LIMIT 1
  `;
  const { rows } = await pool_RO.query(query, [pondId, userId]);
  return rows.length > 0;
};

export const createPond = async (userId, data) => {
  const query = `
    INSERT INTO ponds (
      user_id, pond_name, pond_length, pond_width, pond_height,
      total_fish_count, total_fish_weight, feeding_growth_rate
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    )
    RETURNING *
  `;
  const values = [
    userId,
    data.pond_name,
    data.pond_length,
    data.pond_width,
    data.pond_height,
    data.total_fish_count,
    data.total_fish_weight,
    data.feeding_growth_rate,
  ];

  const { rows } = await pool_RW.query(query, values);
  return rows[0];
};

export const updatePond = async (pondId, userId, data) => {
  const setClauses = [];
  const values = [];
  let valueCount = 1;

  const columns = [
    "pond_name",
    "pond_length",
    "pond_width",
    "pond_height",
    "total_fish_count",
    "total_fish_weight",
    "feeding_growth_rate",
  ];

  for (const col of columns) {
    if (data[col] !== undefined) {
      setClauses.push(`${col} = $${valueCount++}`);
      values.push(data[col]);
    }
  }

  if (setClauses.length === 0) {
    const { rows } = await pool_RO.query(
      "SELECT * FROM ponds WHERE id = $1 AND user_id = $2",
      [pondId, userId]
    );
    if (!rows[0]) {
      throw new Error("池塘不存在或您沒有權限修改");
    }
    return rows[0];
  }

  const query = `
    UPDATE ponds
    SET ${setClauses.join(", ")}, updated_at = now()
    WHERE id = $${valueCount++} AND user_id = $${valueCount++}
    RETURNING *
  `;
  values.push(pondId, userId);

  const { rows } = await pool_RW.query(query, values);
  if (!rows[0]) {
    throw new Error("池塘不存在或您沒有權限修改");
  }
  return rows[0];
};

export const deletePond = async (pondId, userId) => {
  const client = await pool_RW.connect();

  try {
    await client.query("BEGIN");

    const pondCheck = await client.query(
      `
        SELECT id
        FROM ponds
        WHERE id = $1 AND user_id = $2
        LIMIT 1
      `,
      [pondId, userId]
    );
    if (pondCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    const sensorResult = await client.query(
      `
        SELECT id
        FROM sensors
        WHERE pond_id = $1
      `,
      [pondId]
    );
    const sensorIds = sensorResult.rows.map((row) => Number(row.id));

    await removeAccessScopeReferences({
      pondIds: [pondId],
      sensorIds,
      client,
    });

    const deleteResult = await client.query(
      `
        DELETE FROM ponds
        WHERE id = $1 AND user_id = $2
        RETURNING id
      `,
      [pondId, userId]
    );

    await client.query("COMMIT");
    return deleteResult.rows.length > 0;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const getLatestSensorData = async (pondId) => {
  const query = `
    SELECT sd.*
    FROM sensor_data sd
    JOIN sensors s ON s.id = sd.sensor_id
    WHERE s.pond_id = $1
    ORDER BY sd.created_at DESC
    LIMIT 1
  `;
  const { rows } = await pool_RO.query(query, [pondId]);
  return rows[0] || null;
};

export const getLatestDailyLog = async (pondId) => {
  const query = `
    SELECT
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
    FROM pond_daily_logs pdl
    WHERE pdl.pond_id = $1
    ORDER BY pdl.log_date DESC, pdl.created_at DESC
    LIMIT 1
  `;
  const { rows } = await pool_RO.query(query, [pondId]);
  return rows[0] || null;
};

export const getPondLatestData = async (pondId, userId) => {
  const hasAccess = await checkPondOwnership(pondId, userId);
  if (!hasAccess) {
    throw new Error("池塘不存在或您沒有權限訪問");
  }

  const pondRows = await pool_RO.query(
    "SELECT * FROM ponds WHERE id = $1 AND user_id = $2",
    [pondId, userId]
  );
  const pond = pondRows.rows[0] || null;

  const sensorData = await getLatestSensorData(pondId);
  const dailyLog = await getLatestDailyLog(pondId);

  return { pond, sensorData, dailyLog };
};
