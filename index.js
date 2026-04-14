import express from "express";
import dotenv from "dotenv";

import cookieParser from "cookie-parser";
import { createProxyMiddleware } from "http-proxy-middleware";

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
import { requireGrafanaBridge } from "./methods/auth.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(cookieParser());

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

app.use(
  "/grafana",
  requireGrafanaBridge,
  createProxyMiddleware({
    target: process.env.GRAFANA_URL,
    changeOrigin: false,
    xfwd: true,
    ws: true,
    pathRewrite: (path) => `/api/grafana${path}`,
    on: {
      proxyReq: (proxyReq, req) => {
        // 固定 Grafana 身份
        proxyReq.setHeader("X-WEBAUTH-USER", "admin");

        // 依照網站使用者身份
        //proxyReq.setHeader("X-WEBAUTH-USER", req.grafanaUser.user_name);

        if (req.headers.host) {
          proxyReq.setHeader("X-Forwarded-Host", req.headers.host);
        }
        proxyReq.setHeader("X-Forwarded-Proto", "https");
      },
      error: (err, req, res) => {
        console.error("grafana proxy error:", err);
        if (!res.headersSent) {
          res.status(502).json({ error: "Grafana proxy failed" });
        }
      },
    },
  }),
);

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
