import { WeatherModule } from "./fetchWeather.js";
import { CronJob } from "cron";
import {
  insertWeatherPrediction,
  insertWeatherActual,
  cleanupAllNullWeatherFK,
  getNullFKCount,
  getLatestWeatherData,
} from "../../SQL_Controller/queries.js";
import { info, error as logError } from "../logger.js";

// 天氣工具實例
let weatherTool = null;

// 天氣數據緩存
let weatherCache = {
  prediction: null,
  actual: null,
  lastUpdate: null,
};

// 天氣定時任務
let weatherCron = null;

// DB欄位到API屬性的映射
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

// 將DB記錄轉換為緩存格式
function convertDbRecordToCache(record, map) {
  if (!record) return null;
  const cacheObject = {};
  for (const dbKey in record) {
    const apiKey = map[dbKey];
    if (apiKey) {
      let value = record[dbKey];
      if ((dbKey === "forecast_datetime" || dbKey === "weather_datetime") && value) {
        value = new Date(value).toISOString();
      }
      cacheObject[apiKey] = value;
    }
  }
  // 只有預測數據在API回應中有success標誌
  if (map === predDbToApiMap) {
    cacheObject.success = true;
  }
  return cacheObject;
}

// 從DB初始化天氣緩存
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
    info("系統", `天氣快取已成功從資料庫載入: prediction: ${!!weatherCache.prediction}, actual: ${!!weatherCache.actual}`);
  } else {
    info("系統", "資料庫中無天氣快取數據，將在首次獲取後建立");
  }
}

// 初始化天氣工具
export function initializeWeatherTool(apiKey) {
  if (!apiKey) {
    logError("系統", new Error("[weatherService] API Key is missing, cannot initialize."));
    return;
  }
  weatherTool = new WeatherModule(apiKey);
  info("系統", `Initializing WeatherModule with API Key: ${apiKey.substring(0, 4)}...`);

  // 創建每分鐘執行的cron任務
  weatherCron = new CronJob(
    "0 * * * * *", // 每分鐘的第0秒執行
    fetchAndProcessWeather,
    null,
    false,
    "Asia/Taipei"
  );

  weatherCron.start();
  info("系統", "[weatherService] 天氣定時任務已啟動，每分鐘執行一次");
}

// 檢查天氣數據是否有更新
function hasWeatherDataChanged(newPrediction, newActual) {
  const isNewPredValid = newPrediction?.success === true;
  const isNewActualValid = newActual?.DateTime !== undefined;

  // If both new data are invalid, nothing changed.
  if (!isNewPredValid && !isNewActualValid) {
    return false;
  }

  // If cache is empty for a valid new data stream, it's a change.
  if ((isNewPredValid && !weatherCache.prediction) || (isNewActualValid && !weatherCache.actual)) {
    return true;
  }

  let predChanged = false;
  if (isNewPredValid && weatherCache.prediction) {
    predChanged = Object.keys(newPrediction).some((key) => {
      if (["queryTime", "success", "date", "DateTime"].includes(key)) return false;
      // Ensure the key exists in cache before comparing
      return weatherCache.prediction.hasOwnProperty(key) && newPrediction[key] !== weatherCache.prediction[key];
    });
  }

  let actualChanged = false;
  if (isNewActualValid && weatherCache.actual) {
    actualChanged = Object.keys(newActual).some((key) => {
      if (key === 'DateTime') return false; // Ignore timestamp for comparison
      // Ensure the key exists in cache before comparing
      return weatherCache.actual.hasOwnProperty(key) && newActual[key] !== weatherCache.actual[key];
    });
  }

  return predChanged || actualChanged;
}

// 獲取並處理天氣數據
export async function fetchAndProcessWeather() {
  if (!weatherTool) {
    logError("系統", new Error("天氣工具未初始化"));
    return;
  }

  try {
    info("系統", `[${new Date().toISOString()}] 開始獲取天氣數據...`);

    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const predictionData = await weatherTool.getWeatherForecast(tomorrow);

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const actualData = await weatherTool.getHistoricalWeather(yesterday);

    info("系統", `天氣預測數據: ${JSON.stringify(predictionData)}`);
    info("系統", `歷史天氣數據: ${JSON.stringify(actualData)}`);

    const isPredSuccess = predictionData?.DateTime !== undefined;
    const isActualSuccess = actualData?.DateTime !== undefined;

    if (isPredSuccess || isActualSuccess) {
      if (hasWeatherDataChanged(predictionData, actualData)) {
        info("系統", "檢測到天氣數據更新，開始處理...");

        if (isPredSuccess) {
          const predResult = await insertWeatherPrediction(predictionData);
          info("系統", `天氣預測已存儲: ${JSON.stringify(predResult)}`);
          weatherCache.prediction = predictionData;
        }

        if (isActualSuccess) {
          const actualResult = await insertWeatherActual(actualData);
          info("系統", `歷史天氣已存儲: ${JSON.stringify(actualResult)}`);
          weatherCache.actual = actualData;
        }

        weatherCache.lastUpdate = new Date();
        info("系統", "天氣數據庫和緩存已更新");
      } else {
        info("系統", "天氣數據內容無變化，跳過資料庫寫入");
      }
    } else {
      info("系統", "天氣數據均獲取失敗，跳過所有處理");
    }

    const now = new Date();
    if (now.getMinutes() % 10 === 0) {
      info("系統", "執行定期NULL FK清理...");
      await cleanupNullFKs();
    }
  } catch (err) {
    logError("系統", err, { body: "獲取或處理天氣數據時發生意外錯誤" });
  }
}

// 清理NULL FK的函數
async function cleanupNullFKs() {
  try {
    const nullFKCount = await getNullFKCount();
    if (nullFKCount.total_null_fk > 0) {
      info("系統", `發現 ${nullFKCount.total_null_fk} 筆需要更新的天氣外鍵，開始清理...`);
      const updatedRows = await cleanupAllNullWeatherFK();
      info("系統", `成功更新 ${updatedRows} 筆感測器紀錄的天氣外鍵`);
    } else {
      info("系統", "沒有需要清理的天氣外鍵");
    }
  } catch (err) {
    logError("系統", err, { body: "清理天氣外鍵失敗" });
  }
}