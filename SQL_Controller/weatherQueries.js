import { pool_RW, pool_RO } from "./db_connect.js";
import { info, error as logError } from "../methods/logger.js";

// 數據驗證和清理函數
function validateAndCleanNumeric(value, fieldName, allowNull = true) {
  if (value === null || value === undefined) {
    return allowNull ? null : 0;
  }

  // 如果是字符串，嘗試轉換
  if (typeof value === "string") {
    const trimmed = value.trim();

    // 處理特殊字符
    if (
      trimmed === "" ||
      trimmed === "--" ||
      trimmed === "-" ||
      trimmed === "N/A" ||
      trimmed === "n/a"
    ) {
      return allowNull ? null : 0;
    }

    // 嘗試轉換為數字
    const numValue = parseFloat(trimmed);
    if (!isNaN(numValue) && isFinite(numValue)) {
      return numValue;
    }

    // 如果無法轉換，記錄警告
    info(
      "系統",
      `[數據驗證] 無法將 ${fieldName} 的值 "${value}" 轉換為數字，將設為 ${
        allowNull ? "null" : "0"
      }`
    );
    return allowNull ? null : 0;
  }

  // 如果已經是數字，直接返回
  if (typeof value === "number") {
    return isFinite(value) ? value : allowNull ? null : 0;
  }

  // 其他類型，嘗試轉換
  const numValue = Number(value);
  if (!isNaN(numValue) && isFinite(numValue)) {
    return numValue;
  }

  info(
    "系統",
    `[數據驗證] 無法將 ${fieldName} 的值 "${value}" 轉換為數字，將設為 ${
      allowNull ? "null" : "0"
    }`
  );
  return allowNull ? null : 0;
}

// 風向資料驗證函數（保持字串格式）
function validateAndCleanWindDirection(value, fieldName, allowNull = true) {
  if (value === null || value === undefined) {
    return allowNull ? null : "";
  }

  // 如果是字符串，清理並返回
  if (typeof value === "string") {
    const trimmed = value.trim();

    // 處理特殊字符
    if (
      trimmed === "" ||
      trimmed === "--" ||
      trimmed === "-" ||
      trimmed === "N/A" ||
      trimmed === "n/a"
    ) {
      return allowNull ? null : "";
    }

    // 返回清理後的字串
    return trimmed;
  }

  // 其他類型，轉換為字串
  return String(value);
}

function validateAndCleanDate(value, fieldName) {
  if (value === null || value === undefined) {
    return null;
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) {
    info(
      "系統",
      `[數據驗證] 無法將 ${fieldName} 的值 "${value}" 轉換為有效日期，將設為 null`
    );
    return null;
  }

  return date;
}

// 為風速設計的特殊清理函數，可以處理 ">= 11" 這樣的字串
function parseAndValidateWindSpeed(value, fieldName, allowNull = true) {
  if (value === null || value === undefined) {
    return allowNull ? null : 0;
  }

  if (typeof value === "number") {
    return isFinite(value) ? value : allowNull ? null : 0;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    // 使用正則表達式從字串中尋找第一個數字 (包括小數)
    const match = trimmed.match(/\d+(\.\d+)?/);
    if (match) {
      const numValue = parseFloat(match[0]);
      if (!isNaN(numValue) && isFinite(numValue)) {
        return numValue;
      }
    }
  }

  // 如果以上方法都失敗，回退到原始的嚴格驗證，這可能會返回null並印出警告
  return validateAndCleanNumeric(value, fieldName, allowNull);
}

// 插入天氣預測數據
export async function insertWeatherPrediction(weatherData) {
  const query = `
    INSERT INTO weather_pred (
      avg_temperature, max_temperature, min_temperature, dew_point,
      relative_humidity, max_apparent_temperature, min_apparent_temperature,
      comfort_index_max, comfort_index_min, wind_speed, wind_direction,
      precipitation_probability_12h, weather_code, uv_index, forecast_datetime
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
    )
    ON CONFLICT (forecast_datetime) 
    DO UPDATE SET
      avg_temperature = EXCLUDED.avg_temperature,
      max_temperature = EXCLUDED.max_temperature,
      min_temperature = EXCLUDED.min_temperature,
      dew_point = EXCLUDED.dew_point,
      relative_humidity = EXCLUDED.relative_humidity,
      max_apparent_temperature = EXCLUDED.max_apparent_temperature,
      min_apparent_temperature = EXCLUDED.min_apparent_temperature,
      comfort_index_max = EXCLUDED.comfort_index_max,
      comfort_index_min = EXCLUDED.comfort_index_min,
      wind_speed = EXCLUDED.wind_speed,
      wind_direction = EXCLUDED.wind_direction,
      precipitation_probability_12h = EXCLUDED.precipitation_probability_12h,
      weather_code = EXCLUDED.weather_code,
      uv_index = EXCLUDED.uv_index,
      updated_at = now()
    RETURNING id, forecast_datetime
  `;

  const values = [
    validateAndCleanNumeric(weatherData.AvgTemperature, "AvgTemperature"),
    validateAndCleanNumeric(weatherData.MaxTemperature, "MaxTemperature"),
    validateAndCleanNumeric(weatherData.MinTemperature, "MinTemperature"),
    validateAndCleanNumeric(weatherData.DewPoint, "DewPoint"),
    validateAndCleanNumeric(weatherData.RelativeHumidity, "RelativeHumidity"),
    validateAndCleanNumeric(
      weatherData.MaxApparentTemperature,
      "MaxApparentTemperature"
    ),
    validateAndCleanNumeric(
      weatherData.MinApparentTemperature,
      "MinApparentTemperature"
    ),
    validateAndCleanNumeric(weatherData.ComfortIndexMax, "ComfortIndexMax"),
    validateAndCleanNumeric(weatherData.ComfortIndexMin, "ComfortIndexMin"),
    parseAndValidateWindSpeed(weatherData.WindSpeed, "WindSpeed"),
    validateAndCleanWindDirection(weatherData.WindDirection, "WindDirection"),
    validateAndCleanNumeric(
      weatherData.PrecipitationProbability12h,
      "PrecipitationProbability12h"
    ),
    validateAndCleanNumeric(weatherData.WeatherCode, "WeatherCode"),
    validateAndCleanNumeric(weatherData.UVIndex, "UVIndex"),
    validateAndCleanDate(weatherData.DateTime, "DateTime"),
  ];

  const { rows } = await pool_RW.query(query, values);
  return rows[0];
}

// 插入歷史天氣數據
export async function insertWeatherActual(weatherData) {
  const query = `
    INSERT INTO weather_actual (
      air_pressure, air_temperature, relative_humidity,
      wind_speed, wind_direction, precipitation, weather_datetime
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7
    )
    ON CONFLICT (weather_datetime) 
    DO UPDATE SET
      air_pressure = EXCLUDED.air_pressure,
      air_temperature = EXCLUDED.air_temperature,
      relative_humidity = EXCLUDED.relative_humidity,
      wind_speed = EXCLUDED.wind_speed,
      wind_direction = EXCLUDED.wind_direction,
      precipitation = EXCLUDED.precipitation,
      updated_at = now()
    RETURNING id, weather_datetime
  `;

  const values = [
    validateAndCleanNumeric(weatherData.AirPressure, "AirPressure"),
    validateAndCleanNumeric(weatherData.AirTemperature, "AirTemperature"),
    validateAndCleanNumeric(weatherData.RelativeHumidity, "RelativeHumidity"),
    validateAndCleanNumeric(weatherData.WindSpeed, "WindSpeed"),
    validateAndCleanWindDirection(weatherData.WindDirection, "WindDirection"),
    validateAndCleanNumeric(weatherData.Precipitation, "Precipitation"),
    validateAndCleanDate(weatherData.DateTime, "DateTime"),
  ];

  try {
    const { rows } = await pool_RW.query(query, values);
    return rows[0];
  } catch (err) {
    logError("資料庫", err, { body: weatherData });
    throw err;
  }
}

// 獲取最接近指定時間的天氣預測ID
export async function getClosestWeatherPredictionId(targetDateTime) {
  const query = `
    SELECT id, forecast_datetime
    FROM weather_pred
    ORDER BY ABS(EXTRACT(EPOCH FROM (forecast_datetime - $1)))
    LIMIT 1
  `;

  const { rows } = await pool_RO.query(query, [targetDateTime]);
  return rows[0] || null;
}

// 獲取最接近指定時間的歷史天氣ID
export async function getClosestWeatherActualId(targetDateTime) {
  const query = `
    SELECT id, weather_datetime
    FROM weather_actual
    ORDER BY ABS(EXTRACT(EPOCH FROM (weather_datetime - $1)))
    LIMIT 1
  `;

  const { rows } = await pool_RO.query(query, [targetDateTime]);
  return rows[0] || null;
}

// 更新sensor_data表的天氣外鍵
export async function updateSensorDataWeatherFK(
  pondId,
  startDateTime,
  endDateTime
) {
  const query = `
    UPDATE sensor_data sd
    SET 
      fk_weather_actual_id = (
        SELECT id FROM weather_actual 
        WHERE weather_datetime <= sd.created_at
        ORDER BY ABS(EXTRACT(EPOCH FROM (weather_datetime - sd.created_at)))
        LIMIT 1
      ),
      fk_weather_pred_id = (
        SELECT id FROM weather_pred 
        WHERE forecast_datetime >= sd.created_at
        ORDER BY ABS(EXTRACT(EPOCH FROM (forecast_datetime - sd.created_at)))
        LIMIT 1
      )
    FROM sensors s
    WHERE sd.sensor_id = s.id
      AND s.pond_id = $1 
      AND sd.created_at >= $2 
      AND sd.created_at <= $3
      AND (sd.fk_weather_actual_id IS NULL OR sd.fk_weather_pred_id IS NULL)
  `;

  const { rowCount } = await pool_RW.query(query, [
    pondId,
    startDateTime,
    endDateTime,
  ]);
  return rowCount;
}

// 清理所有池塘的NULL FK（新增函數）
export async function cleanupAllNullWeatherFK() {
  const query = `
    UPDATE sensor_data
    SET 
      fk_weather_actual_id = (
        SELECT id FROM weather_actual 
        WHERE weather_datetime <= created_at
        ORDER BY ABS(EXTRACT(EPOCH FROM (weather_datetime - created_at)))
        LIMIT 1
      ),
      fk_weather_pred_id = (
        SELECT id FROM weather_pred 
        WHERE forecast_datetime >= created_at
        ORDER BY ABS(EXTRACT(EPOCH FROM (forecast_datetime - created_at)))
        LIMIT 1
      )
    WHERE (fk_weather_actual_id IS NULL OR fk_weather_pred_id IS NULL)
      AND EXISTS (SELECT 1 FROM weather_actual LIMIT 1)
      AND EXISTS (SELECT 1 FROM weather_pred LIMIT 1)
  `;

  const { rowCount } = await pool_RW.query(query);
  return rowCount;
}

// 獲取需要更新FK的sensor_data記錄數量
export async function getNullFKCount() {
  const query = `
    SELECT 
      COUNT(*) as total_null_fk,
      COUNT(CASE WHEN fk_weather_actual_id IS NULL THEN 1 END) as null_actual_fk,
      COUNT(CASE WHEN fk_weather_pred_id IS NULL THEN 1 END) as null_pred_fk
    FROM sensor_data
    WHERE fk_weather_actual_id IS NULL OR fk_weather_pred_id IS NULL
  `;

  const { rows } = await pool_RO.query(query);
  return rows[0] || { total_null_fk: 0, null_actual_fk: 0, null_pred_fk: 0 };
}

// 獲取最新的天氣數據時間
export async function getLatestWeatherTimes() {
  const query = `
    SELECT 
      (SELECT MAX(forecast_datetime) FROM weather_pred) as latest_pred_time,
      (SELECT MAX(weather_datetime) FROM weather_actual) as latest_actual_time
  `;

  const { rows } = await pool_RO.query(query);
  return rows[0] || { latest_pred_time: null, latest_actual_time: null };
}

// 獲取最新的天氣數據記錄
export async function getLatestWeatherData() {
  const predQuery = `
    SELECT * FROM weather_pred ORDER BY forecast_datetime DESC LIMIT 1
  `;
  const actualQuery = `
    SELECT * FROM weather_actual ORDER BY weather_datetime DESC LIMIT 1
  `;

  try {
    const predResult = await pool_RO.query(predQuery);
    const actualResult = await pool_RO.query(actualQuery);

    return {
      prediction: predResult.rows[0] || null,
      actual: actualResult.rows[0] || null,
    };
  } catch (err) {
    logError("資料庫", err);
    return { prediction: null, actual: null };
  }
}
