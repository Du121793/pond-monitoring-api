import {
  createSensorCrashReport,
  createSensorMaintenanceRecord,
  updateSensorLocalIpIfChanged,
} from "../../SQL_Controller/index.js";
import { handleSensorData } from "../../methods/index.js";
import { info, error as logError } from "../../methods/logger.js";

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

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

const normalizeObject = (value) => (isPlainObject(value) ? value : {});

const normalizeText = (value) => {
  if (value === null || value === undefined) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized || null;
};

const ensureSensorContext = (req, res) => {
  const { pond_id, user_id, sensor_id } = req.user || {};

  if (!pond_id || !sensor_id || !user_id) {
    const err = new Error("token 缺少 pond_id / sensor_id / user_id");
    logError(user_id, err, req);
    res.status(400).json({
      ok: false,
      message: "token 缺少 pond_id / sensor_id / user_id",
    });
    return null;
  }

  return { pond_id, user_id, sensor_id };
};

const syncSensorLocalIp = async (sensor_id, localIp) => {
  if (localIp) {
    await updateSensorLocalIpIfChanged(sensor_id, localIp);
  }
};

export const postSensorDataV1 = async (req, res) => {
  const { pond_id, user_id, sensor_id } = req.user || {};

  if (!pond_id) {
    logError(user_id, new Error("token 缺少 pond_id"), req);
    return res.status(400).json({ ok: false, message: "token 缺少 pond_id" });
  }

  const sensorData = {
    ...req.body,
    pond_id,
    sensor_id,
  };

  try {
    const result = await handleSensorData(sensorData);
    info(user_id, "sensor-data-v1-include", req.ip);
    return res.json({ ok: true, data: result });
  } catch (err) {
    logError(user_id, err, req);
    return res.status(500).json({ ok: false, message: "感測資料寫入失敗" });
  }
};

export const postSensorData = async (req, res) => {
  const context = ensureSensorContext(req, res);
  if (!context) {
    return;
  }

  const { pond_id, user_id, sensor_id } = context;
  const sensorData = {
    ...buildSensorDataFromRequest(req),
    pond_id,
    sensor_id,
  };

  try {
    const result = await handleSensorData(sensorData);
    info(user_id, "sensor-data-include", req.ip);
    return res.json({ ok: true, data: result });
  } catch (err) {
    logError(user_id, err, req);
    return res.status(500).json({ ok: false, message: "感測資料寫入失敗" });
  }
};

export const postMaintenanceRecord = async (req, res) => {
  const context = ensureSensorContext(req, res);
  if (!context) {
    return;
  }

  const { pond_id, user_id, sensor_id } = context;
  const {
    sensorId: _sensorId,
    sensor_id: _sensorId2,
    pond_id: _pondId,
    user_id: _userId,
    local_ip,
    calibration_start,
    calibration_time,
    date,
    before,
    after,
    ...rest
  } = req.body || {};

  try {
    await syncSensorLocalIp(sensor_id, normalizeText(local_ip));

    const record = await createSensorMaintenanceRecord({
      sensor_id,
      pond_id,
      user_id,
      local_ip,
      calibration_start,
      calibration_time: calibration_time || date,
      reported_at: date || calibration_time,
      before,
      after,
      raw_payload: {
        ...rest,
        local_ip: local_ip ?? null,
        calibration_start: calibration_start ?? null,
        calibration_time: calibration_time ?? null,
        date: date ?? null,
        before: normalizeObject(before),
        after: normalizeObject(after),
      },
    });

    info(user_id, "sensor-maintenance-record", req.ip);
    return res.json({ ok: true, record });
  } catch (err) {
    logError(user_id, err, req);
    return res.status(500).json({ ok: false, message: "校正紀錄寫入失敗" });
  }
};

export const postCrashReport = async (req, res) => {
  const context = ensureSensorContext(req, res);
  if (!context) {
    return;
  }

  const { pond_id, user_id, sensor_id } = context;
  const {
    sensorId: _sensorId,
    sensor_id: _sensorId2,
    pond_id: _pondId,
    user_id: _userId,
    local_ip,
    date,
    created_at,
    msg_err,
    log_text,
    ...rest
  } = req.body || {};

  const normalizedMsg = normalizeText(msg_err);
  if (!normalizedMsg) {
    return res
      .status(400)
      .json({ ok: false, message: "msg_err 為必填欄位" });
  }

  try {
    await syncSensorLocalIp(sensor_id, normalizeText(local_ip));

    const record = await createSensorCrashReport({
      sensor_id,
      pond_id,
      user_id,
      local_ip,
      reported_at: date || created_at,
      msg_err: normalizedMsg,
      log_text,
      raw_payload: {
        ...rest,
        local_ip: local_ip ?? null,
        date: date ?? null,
        created_at: created_at ?? null,
        msg_err: normalizedMsg,
        log_text: log_text ?? null,
      },
    });

    info(user_id, "sensor-crash-report", req.ip);
    return res.json({ ok: true, record });
  } catch (err) {
    logError(user_id, err, req);
    return res.status(500).json({ ok: false, message: "Crash 報告寫入失敗" });
  }
};
