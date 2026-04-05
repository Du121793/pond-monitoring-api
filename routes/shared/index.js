import express from "express";
import { requireAccessKey } from "./access_middleware.js";
import {
  getSharedPonds,
  getSharedSensors,
  getSharedDailyLogs,
  getSharedSensorDataMinuteAgg,
} from "../../SQL_Controller/shared_data.js";

import dataRouter from "./data/index.js";

const router = express.Router();

router.get("/getInfo", requireAccessKey, async (req, res) => {
  try {
    const access = req.access;
    const allowedPondIds = (access.pond_ids || []).map((id) => Number(id));
    const allowedSensorIds = (access.sensor_ids || []).map((id) => Number(id));

    const pondLimit = allowedPondIds.length;
    const sensorLimit = allowedSensorIds.length;

    const pondResult = await getSharedPonds({
      pondIds: allowedPondIds,
      limit: pondLimit,
      offset: 0,
    });
    const sensorResult = await getSharedSensors({
      sensorIds: allowedSensorIds,
      limit: sensorLimit,
      offset: 0,
    });

    res.json({
      ok: true,
      message: "成功取得 access 資訊",
      access: {
        id: access.id,
        access_preview: access.access_preview || null,
        expires_at: access.expires_at,
        max_requests: access.max_requests,
        used_requests: access.used_requests,
        remaining_requests: Math.max(
          Number(access.max_requests) - Number(access.used_requests),
          0,
        ),
        revoked_at: access.revoked_at,
      },
      allowed: {
        pond_ids: allowedPondIds,
        sensor_ids: allowedSensorIds,
        ponds: pondResult.rows,
        sensors: sensorResult.rows,
      },
      manual: {
        access: "所有查詢請以 ?access=<access_key> 傳入",
        description: "本手冊提供公開查詢的端點用途與使用方式，所有路由僅支援 GET。",
        endpoints: {
          getInfo: "/shared/getInfo?access=<access_key>",
          common: "/shared/common?access=<access_key>",
          ponds: "/shared/data/ponds?access=<access_key>",
          sensors: "/shared/data/sensors?access=<access_key>",
          dailyLogs: "/shared/data/daily-logs?access=<access_key>",
          sensorData: "/shared/data/sensor-data?access=<access_key>",
        },
        endpoints_detail: [
          {
            path: "/shared/getInfo",
            purpose: "查詢 access 可用的池塘/感測器清單與手冊說明",
            usage: "GET /shared/getInfo?access=<access_key>",
          },
          {
            path: "/shared/common",
            purpose: "取得常用資訊（池塘與感測器清單、近 1 天感測器數據、近 30 天日常記錄、3/7 天趨勢）",
            usage: "GET /shared/common?access=<access_key>",
          },
          {
            path: "/shared/data/ponds",
            purpose: "查詢池塘基本資訊（可依 pond_id / pond_ids 篩選）",
            usage: "GET /shared/data/ponds?access=<access_key>&pond_ids=1,2",
          },
          {
            path: "/shared/data/sensors",
            purpose: "查詢感測器基本資訊（可依 sensor_id / pond_id 篩選）",
            usage: "GET /shared/data/sensors?access=<access_key>&sensor_ids=10,11",
          },
          {
            path: "/shared/data/daily-logs",
            purpose: "查詢日常記錄（可依 pond_id 與日期區間篩選）",
            usage: "GET /shared/data/daily-logs?access=<access_key>&pond_id=1&start_date=2026-02-01&end_date=2026-02-10",
          },
          {
            path: "/shared/data/sensor-data",
            purpose: "查詢感測器數據（可依 sensor_id / pond_id 與日期區間篩選）",
            usage: "GET /shared/data/sensor-data?access=<access_key>&sensor_id=10&start_date=2026-02-01&end_date=2026-02-10&granularity=minute",
          },
        ],
        query: {
          ponds: ["pond_id", "pond_ids", "limit", "offset"],
          sensors: ["sensor_id", "sensor_ids", "pond_id", "pond_ids", "limit", "offset"],
          dailyLogs: [
            "pond_id",
            "pond_ids",
            "start_date",
            "end_date",
            "limit",
            "offset",
          ],
          sensorData: [
            "sensor_id",
            "sensor_ids",
            "pond_id",
            "pond_ids",
            "start_date",
            "end_date",
            "limit",
            "offset",
            "granularity(raw|second|minute)",
          ],
        },
        notes: [
          "所有路由僅支援 GET",
          "傳入的 pond_id / sensor_id 必須在 access 允許範圍內",
          "日期格式: YYYY-MM-DD",
          "granularity=minute 會回傳每分鐘的 min/max/avg/std 彙總",
        ],
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "取得 access 資訊失敗",
      detail: err.message,
    });
  }
});

router.get("/common", requireAccessKey, async (req, res) => {
  try {
    const access = req.access;
    const allowedPondIds = (access.pond_ids || []).map((id) => Number(id));
    const allowedSensorIds = (access.sensor_ids || []).map((id) => Number(id));

    const pondResult = await getSharedPonds({
      pondIds: allowedPondIds,
      limit: allowedPondIds.length,
      offset: 0,
    });
    const sensorResult = await getSharedSensors({
      sensorIds: allowedSensorIds,
      limit: allowedSensorIds.length,
      offset: 0,
    });

    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const formatDate = (date) => date.toISOString().slice(0, 10);

    const sensorData1d = await getSharedSensorDataMinuteAgg({
      sensorIds: allowedSensorIds,
      pondIds: allowedPondIds,
      startDate: oneDayAgo.toISOString(),
      endDate: now.toISOString(),
      limit: null,
      offset: null,
    });

    const dailyLogs30d = await getSharedDailyLogs({
      pondIds: allowedPondIds,
      startDate: formatDate(thirtyDaysAgo),
      endDate: formatDate(now),
      limit: 200000,
      offset: 0,
    });

    const trends3d = await getSharedSensorDataMinuteAgg({
      sensorIds: allowedSensorIds,
      pondIds: allowedPondIds,
      startDate: threeDaysAgo.toISOString(),
      endDate: now.toISOString(),
      limit: null,
      offset: null,
    });

    const trends7d = await getSharedSensorDataMinuteAgg({
      sensorIds: allowedSensorIds,
      pondIds: allowedPondIds,
      startDate: sevenDaysAgo.toISOString(),
      endDate: now.toISOString(),
      limit: null,
      offset: null,
    });

    res.json({
      ok: true,
      message: "成功取得常用資訊",
      access: {
        id: access.id,
        access_preview: access.access_preview || null,
        expires_at: access.expires_at,
        max_requests: access.max_requests,
        used_requests: access.used_requests,
        remaining_requests: Math.max(
          Number(access.max_requests) - Number(access.used_requests),
          0,
        ),
      },
      ponds: pondResult.rows,
      sensors: sensorResult.rows,
      sensor_data_1d: {
        granularity: "minute",
        data: sensorData1d.rows,
      },
      daily_logs_30d: dailyLogs30d.rows,
      trends: {
        days_3: {
          granularity: "minute",
          data: trends3d.rows,
        },
        days_7: {
          granularity: "minute",
          data: trends7d.rows,
        },
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "取得常用資訊失敗",
      detail: err.message,
    });
  }
});

router.use("/data", requireAccessKey, dataRouter);

export default router;
