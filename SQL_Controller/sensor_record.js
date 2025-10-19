import { pool_RW } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";

/**
 * 尋找可合併的感測器紀錄。
 * 在過去 20 秒內尋找一個狀態為 'partial' 的紀錄。
 * 如果傳入的資料包含 RGB，則尋找一個不含 RGB 的紀錄，反之亦然。
 * @param {string} pond_id - 魚塭的 ID。
 * @param {boolean} hasRGB - 傳入的資料是否包含 RGB 數值。
 * @returns {Promise<object|null>} - 返回找到的紀錄或 null。
 */
export const findMergeableRecord = async (pond_id, hasRGB) => {
  let query;
  if (hasRGB) {
    // 尋找沒有 RGB 值的紀錄
    query = `
      SELECT id, created_at FROM sensor_data
      WHERE pond_id = $1
        AND status = 'partial'
        AND rgb_r IS NULL AND rgb_g IS NULL AND rgb_b IS NULL
        AND created_at > NOW() - INTERVAL '20 seconds'
      ORDER BY created_at DESC
      LIMIT 1;
    `;
  } else {
    // 尋找已有 RGB 值的紀錄
    query = `
      SELECT id, created_at FROM sensor_data
      WHERE pond_id = $1
        AND status = 'partial'
        AND rgb_r IS NOT NULL AND rgb_g IS NOT NULL AND rgb_b IS NOT NULL
        AND created_at > NOW() - INTERVAL '20 seconds'
      ORDER BY created_at DESC
      LIMIT 1;
    `;
  }

  try {
    const { rows } = await pool_RW.query(query, [pond_id]);
    return rows[0] || null;
  } catch (err) {
    logError("資料庫", err, { body: { pond_id, hasRGB } });
    throw err;
  }
};

const ALL_COLUMNS = [
  "pond_id",
  "ph",
  "turbidity",
  "mq135",
  "mq137",
  "hardness",
  "temp_deep",
  "temp_shallow",
  "dissolved_oxygen",
  "rgb_r",
  "rgb_g",
  "rgb_b",
];

/**
 * 建立一筆新的感測器紀錄，狀態為 'partial'。
 * @param {object} data - 要插入的感測器資料。
 * @returns {Promise<object>} - 一個解析為新建立紀錄的 Promise。
 */
export const createNewRecord = async (data) => {
  const columns = [];
  const values = [];
  const valuePlaceholders = [];
  let valueCount = 1;

  for (const col of ALL_COLUMNS) {
    if (data[col] !== undefined) {
      columns.push(col);
      values.push(data[col]);
      valuePlaceholders.push(`$${valueCount++}`);
    }
  }

  columns.push("status");
  valuePlaceholders.push(`'partial'`);

  const query = `
        INSERT INTO sensor_data (${columns.join(", ")})
        VALUES (${valuePlaceholders.join(", ")})
        RETURNING *;
    `;

  try {
    const { rows } = await pool_RW.query(query, values);
    return rows[0];
  } catch (err) {
    logError("資料庫", err, { body: data });
    throw err;
  }
};

/**
 * 將資料合併到現有的感測器紀錄中，並將狀態設為 'complete'。
 * @param {number} record_id - 要更新的紀錄 ID。
 * @param {object} data - 要合併的新感測器資料。
 * @returns {Promise<object>} - 一個解析為更新後紀錄的 Promise。
 */
export const mergeRecord = async (record_id, data) => {
  const setClauses = [];
  const values = [];
  let valueCount = 1;

  for (const col of ALL_COLUMNS) {
    if (data[col] !== undefined) {
      setClauses.push(`${col} = $${valueCount++}`);
      values.push(data[col]);
    }
  }

  if (setClauses.length === 0) {
    return null; // 沒有要更新的資料
  }

  setClauses.push(`status = 'complete'`);

  const query = `
        UPDATE sensor_data
        SET ${setClauses.join(", ")}
        WHERE id = $${valueCount++}
        RETURNING *;
    `;
  values.push(record_id);

  try {
    const { rows } = await pool_RW.query(query, values);
    return rows[0];
  } catch (err) {
    logError("資料庫", err, { body: { record_id, ...data } });
    throw err;
  }
};
