import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import { createProxyMiddleware } from "http-proxy-middleware";

import { pool_RW } from "./SQL_Controller/db_connect.js";
import { info, error as logError } from "./methods/logger.js";
import sensorsRouter from "./routes/sensors/index.js";
import webRouter from "./routes/web/index.js";
import webAuthRouter from "./routes/web_auth.js";
import sharedRouter from "./routes/shared/index.js";
import webhookRouter from "./routes/webhook/index.js";
import passport from "./config/passport.js";
import { initializePushService } from "./methods/notifications/pushService.js";
import { requireGrafanaBridge } from "./methods/auth.js";
import { startCronJobs } from "./cron/index.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(cookieParser());
app.set("trust proxy", 3);

const PORT = Number(process.env.SERVER_PORT) || 3002;

// 使用重試機制連接到 PostgreSQL
const connectWithRetry = () => {
  pool_RW.connect((err, client, release) => {
    if (err) {
      logError("資料庫", err);
      info("資料庫", "5 秒後重試連接...");
      setTimeout(connectWithRetry, 5000);
      return;
    }

    info("資料庫", "已成功連接到資料庫");
    release();
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
        // proxyReq.setHeader("X-WEBAUTH-USER", req.grafanaUser.user_name);

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

// 必須在全局 express.json() 之前定義特定路由的限制
// 僅針對 /web/ai 路由放寬至 20MB（支援 Base64 附件圖片）
// 其他路由（如 /web/ponds, /sensors）仍會跳過此處，並受後方全局 100kb 限制保護
app.use("/web/ai", express.json({ limit: "20mb" }));

app.use(express.json());
app.use(passport.initialize());
app.use("/sensors", sensorsRouter);
app.use("/web", webRouter);
app.use("/web_auth", webAuthRouter);
// app.use("/shared", sharedRouter);
app.use("/webhook", webhookRouter);

app.listen(PORT, async () => {
  info("系統", `伺服器正在監聽 port ${PORT}`);
  initializePushService();
  await startCronJobs();
});
