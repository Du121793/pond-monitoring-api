import { WeatherModule } from "./fetchWeather.js";
import { fetchAndStoreC2K280RawObservations } from "./weatherObservationRawService.js";
import {
  insertWeatherPrediction,
  insertWeatherActualBatch,
  cleanupAllNullWeatherFK,
  getNullFKCount,
  getLatestWeatherData,
} from "../../SQL_Controller/queries.js";
import { info, error as logError } from "../logger.js";

// 天氣工具實例
let weatherTool = null;

// 天氣數據快取
let weatherCache = {
  prediction: null,
  actual: null,
  lastUpdate: null,
};

let lastRawObservationSyncAt = 0;

const RAW_OBSERVATION_SYNC_INTERVAL_MS = 10 * 60 * 1000;

const predDbToApiMap = {
  avg_temperature: "AvgTemperature",
  max_temperature: "MaxTemperature",
  min_temperature: "MinTemperature",
  dew_point: "DewPoint",
  relative_humidity: "RelativeHumidity",
  max_apparent_temperature: "MaxApparentTemperature",
  min_apparent_temperature: "MinApparentTemperature",
  comfort_index_max: "ComfortIndexMax",
  comfort_index_min: "ComfortIndexMin",
  wind_speed: "WindSpeed",
  wind_direction: "WindDirection",
  precipitation_probability_12h: "PrecipitationProbability12h",
  weather_code: "WeatherCode",
  uv_index: "UVIndex",
  forecast_datetime: "DateTime",
};

const actualDbToApiMap = {
  air_pressure: "AirPressure",
  air_temperature: "AirTemperature",
  relative_humidity: "RelativeHumidity",
  wind_speed: "WindSpeed",
  wind_direction: "WindDirection",
  precipitation: "Precipitation",
  weather_datetime: "DateTime",
};

// 將 DB 記錄轉為快取格式
function convertDbRecordToCache(record, map) {
  if (!record) {
    return null;
  }

  const cacheObject = {};
  for (const dbKey in record) {
    const apiKey = map[dbKey];
    if (!apiKey) {
      continue;
    }

    let value = record[dbKey];
    if ((dbKey === "forecast_datetime" || dbKey === "weather_datetime") && value) {
      value = new Date(value).toISOString();
    }
    cacheObject[apiKey] = value;
  }

  if (map === predDbToApiMap) {
    cacheObject.success = true;
  }

  return cacheObject;
}

// 檢查天氣預報是否有內容變化
function hasPredictionDataChanged(newPrediction) {
  const isNewPredValid = newPrediction?.DateTime !== undefined;
  if (!isNewPredValid) {
    return false;
  }

  if (!weatherCache.prediction) {
    return true;
  }

  return Object.keys(newPrediction).some((key) => {
    if (["queryTime", "success", "date", "DateTime"].includes(key)) {
      return false;
    }

    return (
      Object.prototype.hasOwnProperty.call(weatherCache.prediction, key) &&
      newPrediction[key] !== weatherCache.prediction[key]
    );
  });
}

// 取歷史天氣資料中的最新一筆
function pickLatestActual(actualSeries) {
  if (!Array.isArray(actualSeries) || actualSeries.length === 0) {
    return null;
  }

  return [...actualSeries].sort(
    (a, b) => new Date(a.DateTime).getTime() - new Date(b.DateTime).getTime()
  )[actualSeries.length - 1];
}

export async function initializeCacheFromDB() {
  info("系統", "從資料庫初始化天氣快取...");
  const latestData = await getLatestWeatherData();

  if (latestData.prediction) {
    weatherCache.prediction = convertDbRecordToCache(
      latestData.prediction,
      predDbToApiMap
    );
  }

  if (latestData.actual) {
    weatherCache.actual = convertDbRecordToCache(
      latestData.actual,
      actualDbToApiMap
    );
  }

  if (weatherCache.prediction || weatherCache.actual) {
    info(
      "系統",
      `天氣快取已成功從資料庫載入: prediction=${!!weatherCache.prediction}, actual=${!!weatherCache.actual}`
    );
    return;
  }

  info("系統", "資料庫中無天氣快取資料，將在首次獲取後建立");
}

export function initializeWeatherTool(apiKey) {
  if (!apiKey) {
    logError("系統", new Error("[weatherService] 未提供 API key，無法初始化"));
    return;
  }

  weatherTool = new WeatherModule(apiKey);
  info("系統", `已初始化 WeatherModule，API key: ${apiKey.substring(0, 4)}...`);
}

export async function fetchAndProcessWeather() {
  if (!weatherTool) {
    logError("系統", new Error("天氣工具未初始化"));
    return;
  }

  try {
    info("系統", `[${new Date().toISOString()}] 開始獲取天氣資料...`);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const predictionData = await weatherTool.getWeatherForecast(tomorrow);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const actualSeries = await weatherTool.getHistoricalWeatherByDay(yesterday);

    const isPredSuccess = predictionData?.DateTime !== undefined;
    const isActualSuccess = Array.isArray(actualSeries) && actualSeries.length > 0;

    if (isPredSuccess) {
      info("系統", `天氣預報時間: ${predictionData.DateTime}`);
    } else {
      info("系統", `天氣預報資料格式異常: ${JSON.stringify(predictionData)}`);
    }

    if (isActualSuccess) {
      const firstTime = actualSeries[0]?.DateTime;
      const lastTime = actualSeries[actualSeries.length - 1]?.DateTime;
      info(
        "系統",
        `歷史天氣資料共 ${actualSeries.length} 筆，時間範圍 ${firstTime} -> ${lastTime}`
      );
    } else {
      info("系統", `歷史天氣資料格式異常: ${JSON.stringify(actualSeries)}`);
    }

    let updated = false;

    if (isPredSuccess && hasPredictionDataChanged(predictionData)) {
      const predResult = await insertWeatherPrediction(predictionData);
      info("系統", `天氣預報已存儲: ${JSON.stringify(predResult)}`);
      weatherCache.prediction = predictionData;
      updated = true;
    }

    if (isActualSuccess) {
      const actualResult = await insertWeatherActualBatch(actualSeries);
      info("系統", `歷史天氣已存儲 ${actualResult.length} 筆`);
      weatherCache.actual = pickLatestActual(actualSeries);
      updated = true;
    }

    if (updated) {
      weatherCache.lastUpdate = new Date();
      info("系統", "天氣資料庫與快取已更新");
    } else {
      info("系統", "天氣資料內容無變化，跳過資料庫寫入");
    }

    await syncRawObservationsIfDue();

    const now = new Date();
    if (now.getMinutes() % 10 === 0) {
      info("系統", "執行定期天氣外鍵清理...");
      await cleanupNullFKs();
    }
  } catch (err) {
    logError("系統", err, { body: "獲取或處理天氣資料時發生錯誤" });
  }
}

async function syncRawObservationsIfDue() {
  const now = Date.now();
  if (now - lastRawObservationSyncAt < RAW_OBSERVATION_SYNC_INTERVAL_MS) {
    return;
  }

  lastRawObservationSyncAt = now;

  try {
    await fetchAndStoreC2K280RawObservations(process.env.WEATHER_API_KEY);
  } catch (err) {
    logError("系統", err, {
      body: "同步 C2K280 原始觀測資料到 weather_actual 失敗",
    });
  }
}

async function cleanupNullFKs() {
  try {
    const nullFKCount = await getNullFKCount();
    if (nullFKCount.total_null_fk > 0) {
      info("系統", `發現 ${nullFKCount.total_null_fk} 筆缺少外鍵的天氣資料，開始清理...`);
      const updatedRows = await cleanupAllNullWeatherFK();
      info("系統", `成功更新 ${updatedRows} 筆感測器紀錄的天氣外鍵`);
      return;
    }

    info("系統", "沒有需要清理的天氣外鍵");
  } catch (err) {
    logError("系統", err, { body: "清理天氣外鍵失敗" });
  }
}
