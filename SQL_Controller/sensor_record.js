import { pool_RW } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";

const ALL_COLUMNS = [
  "sensor_id",
  "ph",
  "turbidity_raw",
  "turbidity_percent",
  "turbidity_ntu",
  "hardness",
  "ec_us_cm",
  "orp_mv",
  "mq135",
  "mq137",
  "temp_deep",
  "temp_shallow",
  "rgb_r",
  "rgb_g",
  "rgb_b",
  "created_at",
];

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
