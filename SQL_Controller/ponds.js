import { pool_RW, pool_RO } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";

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
  const query = `
    DELETE FROM ponds
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `;
  const { rows } = await pool_RW.query(query, [pondId, userId]);
  return rows.length > 0;
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
    SELECT *
    FROM pond_daily_logs
    WHERE pond_id = $1
    ORDER BY log_date DESC, created_at DESC
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
