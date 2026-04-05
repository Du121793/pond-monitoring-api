import express from "express";
import { getSharedSensors } from "../../../SQL_Controller/shared_data.js";
import { ensureAllowedIds, parseIdList, parseLimitOffset } from "../helpers.js";

const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const access = req.access;
    const allowedSensorIds = (access.sensor_ids || []).map((id) => Number(id));
    const allowedPondIds = (access.pond_ids || []).map((id) => Number(id));

    const sensorCombined = [];
    if (req.query.sensor_id) sensorCombined.push(req.query.sensor_id);
    if (req.query.sensor_ids) sensorCombined.push(req.query.sensor_ids);
    const sensorParsed = parseIdList(
      sensorCombined.length ? sensorCombined.join(",") : null,
    );
    if (sensorParsed.error) {
      return res.status(400).json({ ok: false, error: sensorParsed.error });
    }

    const pondCombined = [];
    if (req.query.pond_id) pondCombined.push(req.query.pond_id);
    if (req.query.pond_ids) pondCombined.push(req.query.pond_ids);
    const pondParsed = parseIdList(
      pondCombined.length ? pondCombined.join(",") : null,
    );
    if (pondParsed.error) {
      return res.status(400).json({ ok: false, error: pondParsed.error });
    }

    const sensorIds = ensureAllowedIds(sensorParsed.values, allowedSensorIds);
    if (!sensorIds) {
      return res
        .status(403)
        .json({ ok: false, error: "sensor_id 不在允許範圍內" });
    }

    const pondIds = ensureAllowedIds(pondParsed.values, allowedPondIds);
    if (!pondIds) {
      return res
        .status(403)
        .json({ ok: false, error: "pond_id 不在允許範圍內" });
    }

    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset);

    const result = await getSharedSensors({
      sensorIds,
      pondIds,
      limit,
      offset,
    });

    res.json({
      ok: true,
      sensors: result.rows,
      count: result.rows.length,
      total: result.total,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: offset + result.rows.length < result.total,
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "取得感測器資料失敗",
      detail: err.message,
    });
  }
});

export default router;
