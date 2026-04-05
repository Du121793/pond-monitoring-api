import { pool_RO } from "./db_connect.js";

export const getSharedPonds = async ({ pondIds, limit, offset }) => {
  if (!pondIds || pondIds.length === 0) {
    return { rows: [], total: 0 };
  }
  const query = `
    SELECT id, pond_name,
           pond_length, pond_width, pond_height,
           total_fish_count, total_fish_weight, feeding_growth_rate,
           created_at, updated_at
    FROM ponds
    WHERE id = ANY($1::bigint[])
    ORDER BY id ASC
    LIMIT $2 OFFSET $3
  `;
  const { rows } = await pool_RO.query(query, [pondIds, limit, offset]);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM ponds
    WHERE id = ANY($1::bigint[])
  `;
  const countResult = await pool_RO.query(countQuery, [pondIds]);
  return { rows, total: countResult.rows[0]?.total ?? 0 };
};

export const getSharedSensors = async ({ sensorIds, pondIds, limit, offset }) => {
  if (!sensorIds || sensorIds.length === 0) {
    return { rows: [], total: 0 };
  }

  const conditions = [`s.id = ANY($1::bigint[])`];
  const values = [sensorIds];
  let valueCount = 2;

  if (pondIds && pondIds.length > 0) {
    conditions.push(`s.pond_id = ANY($${valueCount++}::bigint[])`);
    values.push(pondIds);
  }

  const query = `
    SELECT s.id, s.pond_id, s.sensor_name,
           s.created_at, s.updated_at
    FROM sensors s
    WHERE ${conditions.join(" AND ")}
    ORDER BY s.id ASC
    LIMIT $${valueCount++} OFFSET $${valueCount++}
  `;
  values.push(limit, offset);

  const { rows } = await pool_RO.query(query, values);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM sensors s
    WHERE ${conditions.join(" AND ")}
  `;
  const countResult = await pool_RO.query(countQuery, values.slice(0, valueCount - 3));
  return { rows, total: countResult.rows[0]?.total ?? 0 };
};

export const getSharedDailyLogs = async ({
  pondIds,
  startDate,
  endDate,
  limit,
  offset,
}) => {
  if (!pondIds || pondIds.length === 0) {
    return { rows: [], total: 0 };
  }

  const conditions = [`pond_id = ANY($1::bigint[])`];
  const values = [pondIds];
  let valueCount = 2;

  if (startDate) {
    conditions.push(`log_date >= $${valueCount++}::date`);
    values.push(startDate);
  }
  if (endDate) {
    conditions.push(`log_date <= $${valueCount++}::date`);
    values.push(endDate);
  }

  const query = `
    SELECT id, pond_id, feeding_amount, death_count, medication_given,
           medication_type, notes, log_date, created_at, updated_at
    FROM pond_daily_logs
    WHERE ${conditions.join(" AND ")}
    ORDER BY log_date DESC, created_at DESC
    LIMIT $${valueCount++} OFFSET $${valueCount++}
  `;
  values.push(limit, offset);

  const { rows } = await pool_RO.query(query, values);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM pond_daily_logs
    WHERE ${conditions.join(" AND ")}
  `;
  const countResult = await pool_RO.query(countQuery, values.slice(0, valueCount - 3));
  return { rows, total: countResult.rows[0]?.total ?? 0 };
};

export const getSharedSensorData = async ({
  sensorIds,
  pondIds,
  startDate,
  endDate,
  limit,
  offset,
}) => {
  if (!sensorIds || sensorIds.length === 0) {
    return { rows: [], total: 0 };
  }

  const conditions = [`sd.sensor_id = ANY($1::bigint[])`];
  const values = [sensorIds];
  let valueCount = 2;

  if (pondIds && pondIds.length > 0) {
    conditions.push(`s.pond_id = ANY($${valueCount++}::bigint[])`);
    values.push(pondIds);
  }
  if (startDate) {
    conditions.push(`sd.created_at >= $${valueCount++}::timestamptz`);
    values.push(startDate);
  }
  if (endDate) {
    conditions.push(`sd.created_at < ($${valueCount++}::date + interval '1 day')`);
    values.push(endDate);
  }

  const query = `
    SELECT sd.*, s.pond_id
    FROM sensor_data sd
    JOIN sensors s ON s.id = sd.sensor_id
    WHERE ${conditions.join(" AND ")}
    ORDER BY sd.created_at DESC
    LIMIT $${valueCount++} OFFSET $${valueCount++}
  `;
  values.push(limit, offset);

  const { rows } = await pool_RO.query(query, values);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM sensor_data sd
    JOIN sensors s ON s.id = sd.sensor_id
    WHERE ${conditions.join(" AND ")}
  `;
  const countResult = await pool_RO.query(countQuery, values.slice(0, valueCount - 3));
  return { rows, total: countResult.rows[0]?.total ?? 0 };
};

const buildSensorDataTimeRange = ({ startDate, endDate, values, conditions, valueCount }) => {
  let nextValueCount = valueCount;
  if (startDate) {
    conditions.push(`sd.created_at >= $${nextValueCount++}::timestamptz`);
    values.push(startDate);
  }
  if (endDate) {
    const isDateOnly = typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate);
    if (isDateOnly) {
      conditions.push(`sd.created_at < ($${nextValueCount++}::date + interval '1 day')`);
      values.push(endDate);
    } else {
      conditions.push(`sd.created_at < $${nextValueCount++}::timestamptz`);
      values.push(endDate);
    }
  }
  return nextValueCount;
};

export const getSharedSensorDataMinuteAgg = async ({
  sensorIds,
  pondIds,
  startDate,
  endDate,
  limit,
  offset,
}) => {
  if (!sensorIds || sensorIds.length === 0) {
    return { rows: [], total: 0 };
  }

  const conditions = [`sd.sensor_id = ANY($1::bigint[])`];
  const values = [sensorIds];
  let valueCount = 2;

  if (pondIds && pondIds.length > 0) {
    conditions.push(`s.pond_id = ANY($${valueCount++}::bigint[])`);
    values.push(pondIds);
  }

  valueCount = buildSensorDataTimeRange({
    startDate,
    endDate,
    values,
    conditions,
    valueCount,
  });

  const countValues = values.slice();
  const usePaging = Number.isInteger(limit) && limit > 0;
  const safeOffset = Number.isInteger(offset) && offset >= 0 ? offset : 0;

  let query = `
    SELECT
      s.pond_id,
      sd.sensor_id,
      date_trunc('minute', sd.created_at) AS bucket_start,
      MIN(sd.ph)                 AS ph_min,
      MAX(sd.ph)                 AS ph_max,
      AVG(sd.ph)                 AS ph_avg,
      STDDEV_SAMP(sd.ph)         AS ph_std,
      MIN(sd.turbidity_raw)      AS turbidity_raw_min,
      MAX(sd.turbidity_raw)      AS turbidity_raw_max,
      AVG(sd.turbidity_raw)      AS turbidity_raw_avg,
      STDDEV_SAMP(sd.turbidity_raw) AS turbidity_raw_std,
      MIN(sd.turbidity_percent)  AS turbidity_percent_min,
      MAX(sd.turbidity_percent)  AS turbidity_percent_max,
      AVG(sd.turbidity_percent)  AS turbidity_percent_avg,
      STDDEV_SAMP(sd.turbidity_percent) AS turbidity_percent_std,
      MIN(sd.turbidity_ntu)      AS turbidity_ntu_min,
      MAX(sd.turbidity_ntu)      AS turbidity_ntu_max,
      AVG(sd.turbidity_ntu)      AS turbidity_ntu_avg,
      STDDEV_SAMP(sd.turbidity_ntu) AS turbidity_ntu_std,
      MIN(sd.hardness)           AS hardness_min,
      MAX(sd.hardness)           AS hardness_max,
      AVG(sd.hardness)           AS hardness_avg,
      STDDEV_SAMP(sd.hardness)   AS hardness_std,
      MIN(sd.ec_us_cm)           AS ec_us_cm_min,
      MAX(sd.ec_us_cm)           AS ec_us_cm_max,
      AVG(sd.ec_us_cm)           AS ec_us_cm_avg,
      STDDEV_SAMP(sd.ec_us_cm)   AS ec_us_cm_std,
      MIN(sd.orp_mv)             AS orp_mv_min,
      MAX(sd.orp_mv)             AS orp_mv_max,
      AVG(sd.orp_mv)             AS orp_mv_avg,
      STDDEV_SAMP(sd.orp_mv)     AS orp_mv_std,
      MIN(sd.do_mg_l)            AS do_mg_l_min,
      MAX(sd.do_mg_l)            AS do_mg_l_max,
      AVG(sd.do_mg_l)            AS do_mg_l_avg,
      STDDEV_SAMP(sd.do_mg_l)    AS do_mg_l_std,
      MIN(sd.do_sat)             AS do_sat_min,
      MAX(sd.do_sat)             AS do_sat_max,
      AVG(sd.do_sat)             AS do_sat_avg,
      STDDEV_SAMP(sd.do_sat)     AS do_sat_std,
      MIN(sd.mq135)              AS mq135_min,
      MAX(sd.mq135)              AS mq135_max,
      AVG(sd.mq135)              AS mq135_avg,
      STDDEV_SAMP(sd.mq135)      AS mq135_std,
      MIN(sd.mq137)              AS mq137_min,
      MAX(sd.mq137)              AS mq137_max,
      AVG(sd.mq137)              AS mq137_avg,
      STDDEV_SAMP(sd.mq137)      AS mq137_std,
      MIN(sd.temp_deep)          AS temp_deep_min,
      MAX(sd.temp_deep)          AS temp_deep_max,
      AVG(sd.temp_deep)          AS temp_deep_avg,
      STDDEV_SAMP(sd.temp_deep)  AS temp_deep_std,
      MIN(sd.temp_shallow)       AS temp_shallow_min,
      MAX(sd.temp_shallow)       AS temp_shallow_max,
      AVG(sd.temp_shallow)       AS temp_shallow_avg,
      STDDEV_SAMP(sd.temp_shallow) AS temp_shallow_std
    FROM sensor_data sd
    JOIN sensors s ON s.id = sd.sensor_id
    WHERE ${conditions.join(" AND ")}
    GROUP BY s.pond_id, sd.sensor_id, bucket_start
    ORDER BY bucket_start DESC, sd.sensor_id ASC
  `;
  if (usePaging) {
    query += ` LIMIT $${valueCount++} OFFSET $${valueCount++}`;
    values.push(limit, safeOffset);
  }

  const { rows } = await pool_RO.query(query, values);

  const countQuery = `
    SELECT COUNT(*)::int AS total
    FROM (
      SELECT 1
      FROM sensor_data sd
      JOIN sensors s ON s.id = sd.sensor_id
      WHERE ${conditions.join(" AND ")}
      GROUP BY s.pond_id, sd.sensor_id, date_trunc('minute', sd.created_at)
    ) t
  `;
  const countResult = await pool_RO.query(countQuery, countValues);

  return { rows, total: countResult.rows[0]?.total ?? 0 };
};
