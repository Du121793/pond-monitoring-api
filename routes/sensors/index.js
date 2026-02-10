import express from "express";
import { handleSensorData } from "../../methods/index.js";
import passport from "../../config/passport.js";
import { info, error as logError } from "../../methods/logger.js";

const router = express.Router();

router.use(passport.authenticate("jwt-sensor", { session: false }));

const buildSensorDataFromRequest = (req) => {
  const {
    sensorId: _sensorId,
    sensor_id: _sensorId2,
    pond_id: _pondId,
    user_id: _userId,
    date,
    created_at: bodyCreatedAt,
    ...body
  } = req.body || {};

  const sensorData = { ...body };

  if (date) {
    sensorData.created_at = date;
  } else if (bodyCreatedAt) {
    sensorData.created_at = bodyCreatedAt;
  }

  return sensorData;
};

router.post("/v1/include", async (req, res) => {
  const { pond_id, user_id, sensor_id } = req.user || {};

  if (!pond_id) {
    logError(user_id, new Error("token 中缺少 pond_id"), req);
    return res.status(400).json({ message: "token 中缺少 pond_id" });
  }

  const sensorData = {
    ...req.body,
    pond_id,
    sensor_id,
  };

  try {
    const result = await handleSensorData(sensorData);
    info(user_id, "感測器資料已成功接收", req.ip);
    res.json({ ok: true, data: result });
  } catch (err) {
    logError(user_id, err, req);
    res
      .status(500)
      .json({ ok: false, message: "感測器資料處理失敗" });
  }
});

router.post("/include", async (req, res) => {
  const { pond_id, user_id, sensor_id } = req.user || {};

  if (!pond_id || !sensor_id || !user_id) {
    logError(
      user_id,
      new Error("token 中缺少 pond_id / sensor_id / user_id"),
      req
    );
    return res
      .status(400)
      .json({
        message: "token 中缺少 pond_id / sensor_id / user_id",
      });
  }

  const sensorData = {
    ...buildSensorDataFromRequest(req),
    pond_id,
    sensor_id,
  };

  try {
    const result = await handleSensorData(sensorData);
    info(user_id, "感測器資料已成功接收", req.ip);
    res.json({ ok: true, data: result });
  } catch (err) {
    logError(user_id, err, req);
    res
      .status(500)
      .json({ ok: false, message: "感測器資料處理失敗" });
  }
});

router.get("/auth/token-check", (req, res) => {
  info(req.user.user_id, "token-check", req.ip);
  res.json({
    ok: true,
    user: req.user,
  });
});

export default router;
