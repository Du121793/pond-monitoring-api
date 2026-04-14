import { pool_RW, pool_RO } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";

export const getPoolRW = () => pool_RW;

export const getTodayDailyLog = async (pondId) => {
  const query = `
    SELECT *
    FROM pond_daily_logs
    WHERE pond_id = $1 AND log_date = CURRENT_DATE
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const { rows } = await pool_RO.query(query, [pondId]);
  return rows[0] || null;
};

export const getPondsMissingDailyLog = async (targetDate) => {
  const query = `
    SELECT
      p.id AS pond_id,
      p.user_id,
      p.pond_name
    FROM ponds p
    LEFT JOIN pond_daily_logs l
      ON l.pond_id = p.id
     AND l.log_date = $1::date
    WHERE l.id IS NULL
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

  const where = ["pond_id = $1"];
  const values = [pondId];

  if (start_date) {
    values.push(start_date);
    where.push(`log_date >= $${values.length}`);
  }
  if (end_date) {
    values.push(end_date);
    where.push(`log_date <= $${values.length}`);
  }

  const whereSql = where.join(" AND ");

  const totalQuery = `
    SELECT COUNT(*)::int AS total
    FROM pond_daily_logs
    WHERE ${whereSql}
  `;
  const totalResult = await pool_RO.query(totalQuery, values);
  const total = totalResult.rows[0]?.total || 0;

  const logsQuery = `
    SELECT *
    FROM pond_daily_logs
    WHERE ${whereSql}
    ORDER BY log_date DESC, created_at DESC
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

export const createDailyLog = async (pondId, data) => {
  const checkQuery = `
    SELECT 1
    FROM pond_daily_logs
    WHERE pond_id = $1 AND log_date = $2
    LIMIT 1
  `;
  const check = await pool_RO.query(checkQuery, [pondId, data.log_date]);
  if (check.rows.length > 0) {
    throw new Error("該日期已有記錄，每日只能有一筆記錄");
  }

  const query = `
    INSERT INTO pond_daily_logs (
      pond_id, feeding_amount, death_count, medication_given,
      medication_type, notes, log_date
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    )
    RETURNING *
  `;
  const values = [
    pondId,
    data.feeding_amount,
    data.death_count,
    data.medication_given,
    data.medication_type,
    data.notes,
    data.log_date,
  ];

  const { rows } = await pool_RW.query(query, values);
  return rows[0];
};

export const updateDailyLog = async (logId, pondId, data) => {
  if (data.log_date) {
    const checkQuery = `
      SELECT 1
      FROM pond_daily_logs
      WHERE pond_id = $1 AND log_date = $2 AND id <> $3
      LIMIT 1
    `;
    const check = await pool_RO.query(checkQuery, [
      pondId,
      data.log_date,
      logId,
    ]);
    if (check.rows.length > 0) {
      throw new Error("該日期已有其他記錄，每日只能有一筆記錄");
    }
  }

  const setClauses = [];
  const values = [];
  let valueCount = 1;

  const columns = [
    "feeding_amount",
    "death_count",
    "medication_given",
    "medication_type",
    "notes",
    "log_date",
  ];

  for (const col of columns) {
    if (data[col] !== undefined) {
      setClauses.push(`${col} = $${valueCount++}`);
      values.push(data[col]);
    }
  }

  if (setClauses.length === 0) {
    const { rows } = await pool_RO.query(
      "SELECT * FROM pond_daily_logs WHERE id = $1 AND pond_id = $2",
      [logId, pondId]
    );
    if (!rows[0]) {
      throw new Error("記錄不存在或您沒有權限修改");
    }
    return rows[0];
  }

  const query = `
    UPDATE pond_daily_logs
    SET ${setClauses.join(", ")}, updated_at = now()
    WHERE id = $${valueCount++} AND pond_id = $${valueCount++}
    RETURNING *
  `;
  values.push(logId, pondId);

  const { rows } = await pool_RW.query(query, values);
  if (!rows[0]) {
    throw new Error("記錄不存在或您沒有權限修改");
  }
  return rows[0];
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
