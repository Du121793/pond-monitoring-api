import { pool_RW } from "./db_connect.js";
import { error as logError } from "../methods/logger.js";

function cleanNumber(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number") {
    return Number.isFinite(value) && value > -90 ? value : null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (
      trimmed === "" ||
      trimmed === "--" ||
      trimmed === "-" ||
      trimmed === "-99" ||
      trimmed === "-99.0" ||
      trimmed === "-999" ||
      trimmed === "N/A" ||
      trimmed === "n/a"
    ) {
      return null;
    }

    const num = Number(trimmed);
    return Number.isFinite(num) && num > -90 ? num : null;
  }

  const num = Number(value);
  return Number.isFinite(num) && num > -90 ? num : null;
}

function cleanDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const weatherObservationRawUpsertQuery = `
  INSERT INTO weather_observation_raw (
    station_id, station_name, dataset_id, observed_at, fetched_at,
    source_payload, weather,
    county_name, town_name, station_latitude, station_longitude, station_altitude,
    air_pressure, air_temperature, relative_humidity,
    wind_speed, wind_direction, precipitation,
    precipitation_10min, precipitation_1hr, precipitation_3hr,
    precipitation_6hr, precipitation_12hr, precipitation_24hr,
    precipitation_2days, precipitation_3days,
    sunshine_duration, solar_radiation
  ) VALUES (
    $1, $2, $3, $4, $5,
    $6::jsonb, $7,
    $8, $9, $10, $11, $12,
    $13, $14, $15,
    $16, $17, $18,
    $19, $20, $21,
    $22, $23, $24,
    $25, $26,
    $27, $28
  )
  ON CONFLICT (station_id, dataset_id, observed_at)
  DO UPDATE SET
    station_name = EXCLUDED.station_name,
    fetched_at = EXCLUDED.fetched_at,
    source_payload = EXCLUDED.source_payload,
    weather = EXCLUDED.weather,
    county_name = EXCLUDED.county_name,
    town_name = EXCLUDED.town_name,
    station_latitude = EXCLUDED.station_latitude,
    station_longitude = EXCLUDED.station_longitude,
    station_altitude = EXCLUDED.station_altitude,
    air_pressure = EXCLUDED.air_pressure,
    air_temperature = EXCLUDED.air_temperature,
    relative_humidity = EXCLUDED.relative_humidity,
    wind_speed = EXCLUDED.wind_speed,
    wind_direction = EXCLUDED.wind_direction,
    precipitation = EXCLUDED.precipitation,
    precipitation_10min = EXCLUDED.precipitation_10min,
    precipitation_1hr = EXCLUDED.precipitation_1hr,
    precipitation_3hr = EXCLUDED.precipitation_3hr,
    precipitation_6hr = EXCLUDED.precipitation_6hr,
    precipitation_12hr = EXCLUDED.precipitation_12hr,
    precipitation_24hr = EXCLUDED.precipitation_24hr,
    precipitation_2days = EXCLUDED.precipitation_2days,
    precipitation_3days = EXCLUDED.precipitation_3days,
    sunshine_duration = EXCLUDED.sunshine_duration,
    solar_radiation = EXCLUDED.solar_radiation,
    updated_at = now()
  RETURNING id, station_id, dataset_id, observed_at
`;

function buildWeatherObservationRawValues(row) {
  return [
    row.stationId,
    row.stationName ?? null,
    row.datasetId,
    cleanDate(row.observedAt),
    cleanDate(row.fetchedAt) ?? new Date(),
    JSON.stringify(row.sourcePayload ?? {}),
    row.weather ?? null,
    row.countyName ?? null,
    row.townName ?? null,
    cleanNumber(row.stationLatitude),
    cleanNumber(row.stationLongitude),
    cleanNumber(row.stationAltitude),
    cleanNumber(row.airPressure),
    cleanNumber(row.airTemperature),
    cleanNumber(row.relativeHumidity),
    cleanNumber(row.windSpeed),
    cleanNumber(row.windDirection),
    cleanNumber(row.precipitation),
    cleanNumber(row.precipitation10min),
    cleanNumber(row.precipitation1hr),
    cleanNumber(row.precipitation3hr),
    cleanNumber(row.precipitation6hr),
    cleanNumber(row.precipitation12hr),
    cleanNumber(row.precipitation24hr),
    cleanNumber(row.precipitation2days),
    cleanNumber(row.precipitation3days),
    cleanNumber(row.sunshineDuration),
    cleanNumber(row.solarRadiation),
  ];
}

export async function insertWeatherObservationRawBatch(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return [];
  }

  const client = await pool_RW.connect();
  try {
    await client.query("BEGIN");

    const results = [];
    for (const row of rows) {
      const { rows: insertedRows } = await client.query(
        weatherObservationRawUpsertQuery,
        buildWeatherObservationRawValues(row)
      );
      if (insertedRows[0]) {
        results.push(insertedRows[0]);
      }
    }

    await client.query("COMMIT");
    return results;
  } catch (err) {
    await client.query("ROLLBACK");
    logError("天氣原始資料", err, { body: rows });
    throw err;
  } finally {
    client.release();
  }
}
