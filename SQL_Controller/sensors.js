import { pool_RW } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";

export const updateSensorLocalIpIfChanged = async (sensor_id, local_ip) => {
  if (!sensor_id || !local_ip) return null;

  const query = `
    UPDATE sensors
    SET local_ip = $2, updated_at = now()
    WHERE id = $1 AND (local_ip IS DISTINCT FROM $2)
    RETURNING id, local_ip;
  `;

  try {
    const { rows } = await pool_RW.query(query, [sensor_id, local_ip]);
    return rows[0] || null;
  } catch (err) {
    logError("\u8cc7\u6599\u5eab", err, { body: { sensor_id, local_ip } });
    throw err;
  }
};
