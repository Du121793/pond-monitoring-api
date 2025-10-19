import express from "express";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import { pool_RW } from "./SQL_Controller/db_connect.js";
import { handleSensorData } from "./methods/index.js";
import {
  initializeWeatherTool,
  fetchAndProcessWeather,
  initializeCacheFromDB,
} from "./methods/weather/weatherService.js";
import { info, error as logError } from "./methods/logger.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.SERVER_PORT) || 3002;
const JWT_SECRET = process.env.JWT_SECRET;

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

// JWT Token 驗證中間件
const tokenCheck = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(" ")[1];
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        logError("認證失敗", err, req);
        return res.sendStatus(403);
      }
      if (!user.user_id || !user.pond_id) {
        logError("認證失敗", new Error("無效的 token payload"), req);
        return res.status(401).json({ message: "無效的 token payload" });
      }
      req.user = user;
      next();
    });
  } else {
    logError("認證失敗", new Error("缺少 Authorization header"), req);
    res.sendStatus(401);
  }
};

// 確認 JWT 是否有效
app.get("/api/auth/token-check", tokenCheck, (req, res) => {
  info(req.user.user_id, "token-check", req.ip);
  res.json({
    ok: true,
    user: req.user,
  });
});

app.post("/api/include", tokenCheck, async (req, res) => {
  const { pond_id, user_id } = req.user; // from tokenCheck middleware

  if (!pond_id) {
    logError(user_id, new Error("token 中缺少 pond_id"), req);
    return res.status(400).json({ message: "token 中缺少 pond_id" });
  }

  const sensorData = {
    ...req.body,
    pond_id: pond_id,
  };

  try {
    const result = await handleSensorData(sensorData);
    info(user_id, `成功處理感測器數據`, req.ip);
    res.json({ ok: true, data: result });
  } catch (err) {
    logError(user_id, err, req);
    res
      .status(500)
      .json({ ok: false, message: "處理感測器數據時發生錯誤" });
  }
});

app.listen(PORT, async () => {
  info("系統", `伺服器正在監聽 port ${PORT}`);
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
