import { CronJob } from "cron";
import {
  initializeWeatherTool,
  fetchAndProcessWeather,
  initializeCacheFromDB,
} from "../methods/weather/weatherService.js";
import { info, error as logError } from "../methods/logger.js";

export const startWeatherJobs = async () => {
  if (!process.env.WEATHER_API_KEY) {
    info("系統", "[啟動] 未設置 WEATHER_API_KEY，跳過天氣排程");
    return null;
  }

  info("系統", "[啟動] 正在初始化天氣排程...");
  await initializeCacheFromDB();
  initializeWeatherTool(process.env.WEATHER_API_KEY);
  await fetchAndProcessWeather();

  const job = new CronJob(
    "0 * * * * *",
    () => fetchAndProcessWeather().catch((err) => logError("天氣排程", err)),
    null,
    true,
    "Asia/Taipei"
  );

  info("系統", "[啟動] 天氣排程已啟動，每分鐘執行一次");
  return job;
};
