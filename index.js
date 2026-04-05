import express from "express";
import dotenv from "dotenv";
import { pool_RW } from "./SQL_Controller/db_connect.js";
import {
  initializeWeatherTool,
  fetchAndProcessWeather,
  initializeCacheFromDB,
} from "./methods/weather/weatherService.js";
import { info, error as logError } from "./methods/logger.js";
import sensorsRouter from "./routes/sensors/index.js";
import webRouter from "./routes/web/index.js";
import webAuthRouter from "./routes/web_auth.js";
import sharedRouter from "./routes/shared/index.js";
import webhookRouter from "./routes/webhook/index.js";
import passport from "./config/passport.js";
import cors from "cors";
import { deleteExpiredAccessKeys } from "./SQL_Controller/access_keys.js";
import { initializePushService } from "./methods/notifications/pushService.js";
import { startOutboxWorker } from "./methods/notifications/outboxWorker.js";

dotenv.config();

const app = express();
app.use(cors());

const PORT = Number(process.env.SERVER_PORT) || 3002;

// 使用重試機制連接到 PostgreSQL
const connectWithRetry = () => {
  pool_RW.connect((err, client, release) => {
    if (err) {
      logError("資料庫", err);
      info("資料庫", "5秒後重試連接...");
      setTimeout(connectWithRetry, 5000);
    } else {
      info("資料庫", "已成功連接到資料庫");
      release();
    }
  });
};

connectWithRetry();

app.use(express.json());
app.use(passport.initialize());
app.use("/sensors", sensorsRouter);
app.use("/web", webRouter);
app.use("/web_auth", webAuthRouter);
app.use("/shared", sharedRouter);
app.use("/webhook", webhookRouter);

const cleanupAccessIntervalMs = 10 * 60 * 1000;
setInterval(async () => {
  try {
    await deleteExpiredAccessKeys();
  } catch (err) {
    logError("access-cleanup", err);
  }
}, cleanupAccessIntervalMs);

app.listen(PORT, async () => {
  info("系統", `伺服器正在監聽 port ${PORT}`);
  initializePushService();
  startOutboxWorker();
  // 初始化天氣服務
  if (process.env.WEATHER_API_KEY) {
    info("系統", "[啟動] 正在初始化天氣服務...");

    // 從資料庫預熱快取
    await initializeCacheFromDB();

    initializeWeatherTool(process.env.WEATHER_API_KEY);

    // 立即執行一次天氣數據獲取
    await fetchAndProcessWeather();
  } else {
    info("系統", "[啟動] 未設置WEATHER_API_KEY，跳過天氣服務初始化");
  }
});
