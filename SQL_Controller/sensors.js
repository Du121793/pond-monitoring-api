import { pool_RW } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";
import crypto from "crypto";
import { removeAccessScopeReferences } from "./access_keys.js";

export const hashToken = (token) =>
  crypto.createHash("sha256").update(String(token)).digest("hex");

export const getPondSensors = async (pondId) => {
  const query = `
    SELECT *
    FROM sensors
    WHERE pond_id = $1
    ORDER BY created_at DESC
  `;
  const { rows } = await pool_RW.query(query, [pondId]);
  return rows;
};

export const getSensorById = async (pondId, sensorId) => {
  const query = `
    SELECT *
    FROM sensors
    WHERE id = $1 AND pond_id = $2
    LIMIT 1
  `;
  const { rows } = await pool_RW.query(query, [sensorId, pondId]);
  return rows[0] || null;
};

export const getSensorTokenStatus = async (pondId, sensorId) => {
  const query = `
    SELECT token_hash, token_issued_at, token_revoked_at
    FROM sensors
    WHERE id = $1 AND pond_id = $2
    LIMIT 1
  `;
  const { rows } = await pool_RW.query(query, [sensorId, pondId]);
  return rows[0] || null;
};

export const createSensor = async (pondId, { sensor_name, local_ip }) => {
  const query = `
    INSERT INTO sensors (pond_id, sensor_name, local_ip)
    VALUES ($1, $2, $3)
    RETURNING *
  `;
  const { rows } = await pool_RW.query(query, [
    pondId,
    sensor_name,
    local_ip,
  ]);
  return rows[0];
};

export const updateSensor = async (pondId, sensorId, data) => {
  const setClauses = [];
  const values = [];
  let valueCount = 1;

  const columns = ["sensor_name", "local_ip"];
  for (const col of columns) {
    if (data[col] !== undefined) {
      setClauses.push(`${col} = $${valueCount++}`);
      values.push(data[col]);
    }
  }

  if (setClauses.length === 0) {
    const { rows } = await pool_RW.query(
      "SELECT * FROM sensors WHERE id = $1 AND pond_id = $2",
      [sensorId, pondId]
    );
    if (!rows[0]) {
      throw new Error("感測器不存在或您沒有權限修改");
    }
    return rows[0];
  }

  const query = `
    UPDATE sensors
    SET ${setClauses.join(", ")}, updated_at = now()
    WHERE id = $${valueCount++} AND pond_id = $${valueCount++}
    RETURNING *
  `;
  values.push(sensorId, pondId);

  const { rows } = await pool_RW.query(query, values);
  if (!rows[0]) {
    throw new Error("感測器不存在或您沒有權限修改");
  }
  return rows[0];
};

export const deleteSensor = async (pondId, sensorId) => {
  const client = await pool_RW.connect();

  try {
    await client.query("BEGIN");

    const sensorCheck = await client.query(
      `
        SELECT id
        FROM sensors
        WHERE id = $1 AND pond_id = $2
        LIMIT 1
      `,
      [sensorId, pondId]
    );
    if (sensorCheck.rows.length === 0) {
      await client.query("ROLLBACK");
      return false;
    }

    await removeAccessScopeReferences({
      sensorIds: [sensorId],
      client,
    });

    const deleteResult = await client.query(
      `
        DELETE FROM sensors
        WHERE id = $1 AND pond_id = $2
        RETURNING id
      `,
      [sensorId, pondId]
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
    logError("資料庫", err, { body: { sensor_id, local_ip } });
    throw err;
  }
};

export const setSensorTokenHash = async (sensorId, tokenHash) => {
  const query = `
    UPDATE sensors
    SET token_hash = $2, token_issued_at = now(), token_revoked_at = NULL, updated_at = now()
    WHERE id = $1
    RETURNING id, token_hash
  `;
  const { rows } = await pool_RW.query(query, [sensorId, tokenHash]);
  return rows[0] || null;
};

export const clearSensorTokenHash = async (sensorId) => {
  const query = `
    UPDATE sensors
    SET token_hash = NULL, token_revoked_at = now(), updated_at = now()
    WHERE id = $1
    RETURNING id
  `;
  const { rows } = await pool_RW.query(query, [sensorId]);
  return rows[0] || null;
};

export const isSensorTokenValid = async (sensorId, token) => {
  const query = `
    SELECT token_hash
    FROM sensors
    WHERE id = $1
    LIMIT 1
  `;
  const { rows } = await pool_RW.query(query, [sensorId]);
  const tokenHash = rows[0]?.token_hash;
  if (!tokenHash) return false;
  return tokenHash === hashToken(token);
};
