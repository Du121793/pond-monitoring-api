import { pool_RO, pool_RW } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";

export const listAllPondIds = async () => {
  const query = `
    SELECT id
    FROM ponds
    ORDER BY id ASC
  `;
  const { rows } = await pool_RO.query(query);
  return rows.map((row) => Number(row.id)).filter(Number.isFinite);
};

export const getLatestForecasts = async ({ pondIds }) => {
  if (!pondIds || pondIds.length === 0) {
    return [];
  }

  const query = `
    SELECT DISTINCT ON (pfp.pond_id, pfp.metric_name)
      pfp.id,
      pfp.pond_id,
      pfp.prediction_ts,
      pfp.source_feature_ts,
      pfp.forecast_for_ts,
      pfp.horizon_hours,
      pfp.metric_name,
      pfp.current_value,
      pfp.predicted_value,
      pfp.delta_value,
      pfp.model_family,
      pfp.model_version,
      pfp.source_service,
      pfp.raw_payload,
      pfp.created_at,
      pfp.updated_at
    FROM pond_forecast_predictions pfp
    WHERE pfp.pond_id = ANY($1::bigint[])
      AND pfp.horizon_hours = 6
    ORDER BY pfp.pond_id ASC, pfp.metric_name ASC, pfp.prediction_ts DESC, pfp.id DESC
  `;

  const { rows } = await pool_RO.query(query, [pondIds]);
  return rows;
};

export const getLatestRiskScores = async ({ pondIds }) => {
  if (!pondIds || pondIds.length === 0) {
    return [];
  }

  const query = `
    SELECT DISTINCT ON (prp.pond_id)
      prp.id,
      prp.pond_id,
      prp.prediction_ts,
      prp.source_feature_ts,
      prp.risk_for_date,
      prp.risk_type,
      prp.risk_probability,
      prp.risk_score,
      prp.risk_flag,
      prp.risk_level,
      prp.predicted_next_day_death_count,
      prp.model_family,
      prp.model_version,
      prp.source_service,
      prp.raw_payload,
      prp.created_at,
      prp.updated_at
    FROM pond_risk_predictions prp
    WHERE prp.pond_id = ANY($1::bigint[])
      AND prp.risk_type = 'risk_score'
    ORDER BY prp.pond_id ASC, prp.prediction_ts DESC, prp.id DESC
  `;

  const { rows } = await pool_RO.query(query, [pondIds]);
  return rows;
};

const FORECAST_UPSERT_SQL = `
  INSERT INTO pond_forecast_predictions (
    pond_id,
    prediction_ts,
    source_feature_ts,
    forecast_for_ts,
    horizon_hours,
    metric_name,
    current_value,
    predicted_value,
    delta_value,
    model_family,
    model_version,
    source_service,
    raw_payload
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb
  )
  ON CONFLICT (pond_id, prediction_ts, metric_name, horizon_hours)
  DO UPDATE SET
    source_feature_ts = EXCLUDED.source_feature_ts,
    forecast_for_ts = EXCLUDED.forecast_for_ts,
    current_value = EXCLUDED.current_value,
    predicted_value = EXCLUDED.predicted_value,
    delta_value = EXCLUDED.delta_value,
    model_family = EXCLUDED.model_family,
    model_version = EXCLUDED.model_version,
    source_service = EXCLUDED.source_service,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = now()
  WHERE pond_forecast_predictions.model_version IS DISTINCT FROM EXCLUDED.model_version
  RETURNING id
`;

const RISK_UPSERT_SQL = `
  INSERT INTO pond_risk_predictions (
    pond_id,
    prediction_ts,
    source_feature_ts,
    risk_for_date,
    risk_type,
    risk_probability,
    risk_score,
    risk_flag,
    risk_level,
    predicted_next_day_death_count,
    model_family,
    model_version,
    source_service,
    raw_payload
  )
  VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb
  )
  ON CONFLICT (pond_id, prediction_ts, risk_type)
  DO UPDATE SET
    source_feature_ts = EXCLUDED.source_feature_ts,
    risk_for_date = EXCLUDED.risk_for_date,
    risk_probability = EXCLUDED.risk_probability,
    risk_score = EXCLUDED.risk_score,
    risk_flag = EXCLUDED.risk_flag,
    risk_level = EXCLUDED.risk_level,
    predicted_next_day_death_count = EXCLUDED.predicted_next_day_death_count,
    model_family = EXCLUDED.model_family,
    model_version = EXCLUDED.model_version,
    source_service = EXCLUDED.source_service,
    raw_payload = EXCLUDED.raw_payload,
    updated_at = now()
  WHERE pond_risk_predictions.model_version IS DISTINCT FROM EXCLUDED.model_version
  RETURNING id
`;

export const upsertForecastPredictions = async ({
  pondId,
  predictionTs,
  sourceFeatureTs,
  forecast,
  modelVersions,
  sourceService = "model-response-service",
  horizonHours = 6,
}) => {
  const forecastForTs = new Date(new Date(predictionTs).getTime() + horizonHours * 60 * 60 * 1000).toISOString();
  let processed = 0;

  for (const [metricName, metricPayload] of Object.entries(forecast || {})) {
    const values = [
      pondId,
      predictionTs,
      sourceFeatureTs,
      forecastForTs,
      horizonHours,
      metricName,
      metricPayload.current ?? null,
      metricPayload.predicted_6h ?? null,
      metricPayload.delta_6h ?? null,
      metricPayload.model_family ?? "unknown",
      modelVersions?.forecast ?? "unknown",
      sourceService,
      JSON.stringify(metricPayload ?? {}),
    ];

    try {
      await pool_RW.query(FORECAST_UPSERT_SQL, values);
      processed += 1;
    } catch (err) {
      logError("forecast prediction upsert", err, { body: { pondId, predictionTs, metricName } });
      throw err;
    }
  }

  return processed;
};

export const upsertRiskPredictions = async ({
  pondId,
  predictionTs,
  sourceFeatureTs,
  risk,
  riskScore,
  modelVersions,
  riskForDate,
  sourceService = "model-response-service",
}) => {
  const rows = [
    {
      riskType: "risk_flag",
      riskProbability: risk?.risk_probability ?? null,
      riskScoreValue: null,
      riskFlag: risk?.risk_flag ?? null,
      riskLevel: risk?.risk_level ?? null,
      predictedNextDayDeathCount: null,
      modelFamily: risk?.model_family ?? "unknown",
      modelVersion: modelVersions?.risk ?? "unknown",
      rawPayload: risk ?? {},
    },
    {
      riskType: "risk_score",
      riskProbability: null,
      riskScoreValue: riskScore?.risk_score ?? null,
      riskFlag: null,
      riskLevel: riskScore?.risk_level ?? null,
      predictedNextDayDeathCount: riskScore?.predicted_next_day_death_count ?? null,
      modelFamily: riskScore?.model_family ?? "unknown",
      modelVersion: modelVersions?.risk_score ?? "unknown",
      rawPayload: riskScore ?? {},
    },
  ];

  let processed = 0;
  for (const row of rows) {
    const values = [
      pondId,
      predictionTs,
      sourceFeatureTs,
      riskForDate,
      row.riskType,
      row.riskProbability,
      row.riskScoreValue,
      row.riskFlag,
      row.riskLevel,
      row.predictedNextDayDeathCount,
      row.modelFamily,
      row.modelVersion,
      sourceService,
      JSON.stringify(row.rawPayload),
    ];

    try {
      await pool_RW.query(RISK_UPSERT_SQL, values);
      processed += 1;
    } catch (err) {
      logError("risk prediction upsert", err, { body: { pondId, predictionTs, riskType: row.riskType } });
      throw err;
    }
  }

  return processed;
};
