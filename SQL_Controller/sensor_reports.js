import { pool_RW } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

const normalizeTimestamp = (value) => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
};

const normalizeObject = (value) => (isPlainObject(value) ? value : {});

export const createSensorMaintenanceRecord = async ({
  sensor_id,
  pond_id,
  user_id,
  local_ip,
  calibration_start,
  calibration_time,
  reported_at,
  before,
  after,
  raw_payload,
}) => {
  try {
    const { rows } = await pool_RW.query(
      `
        INSERT INTO sensor_maintenance_records (
          sensor_id,
          pond_id,
          user_id,
          local_ip,
          calibration_start,
          calibration_time,
          reported_at,
          before_snapshot,
          after_snapshot,
          raw_payload
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10::jsonb
        )
        RETURNING *
      `,
      [
        sensor_id,
        pond_id,
        user_id,
        normalizeText(local_ip),
        normalizeTimestamp(calibration_start),
        normalizeTimestamp(calibration_time),
        normalizeTimestamp(reported_at),
        JSON.stringify(normalizeObject(before)),
        JSON.stringify(normalizeObject(after)),
        JSON.stringify(normalizeObject(raw_payload)),
      ]
    );

    return rows[0];
  } catch (err) {
    logError("sensor-maintenance-record", err, {
      sensor_id,
      pond_id,
      user_id,
    });
    throw err;
  }
};

export const createSensorCrashReport = async ({
  sensor_id,
  pond_id,
  user_id,
  local_ip,
  reported_at,
  msg_err,
  log_text,
  raw_payload,
}) => {
  try {
    const { rows } = await pool_RW.query(
      `
        INSERT INTO sensor_crash_reports (
          sensor_id,
          pond_id,
          user_id,
          local_ip,
          reported_at,
          msg_err,
          log_text,
          raw_payload
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb
        )
        RETURNING *
      `,
      [
        sensor_id,
        pond_id,
        user_id,
        normalizeText(local_ip),
        normalizeTimestamp(reported_at),
        normalizeText(msg_err),
        normalizeText(log_text),
        JSON.stringify(normalizeObject(raw_payload)),
      ]
    );

    return rows[0];
  } catch (err) {
    logError("sensor-crash-report", err, {
      sensor_id,
      pond_id,
      user_id,
    });
    throw err;
  }
};
