import express from "express";
import {
  getSharedSensorData,
  getSharedSensorDataMinuteAgg,
} from "../../../SQL_Controller/shared_data.js";
import {
  ensureAllowedIds,
  parseDateString,
  parseIdList,
  parseLimitOffset,
} from "../helpers.js";

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

    const startParsed = parseDateString(req.query.start_date);
    if (startParsed?.error) {
      return res.status(400).json({ ok: false, error: startParsed.error });
    }

    const endParsed = parseDateString(req.query.end_date);
    if (endParsed?.error) {
      return res.status(400).json({ ok: false, error: endParsed.error });
    }

    const { limit, offset } = parseLimitOffset(req.query.limit, req.query.offset);
    const granularityRaw = req.query.granularity;
    let granularity = granularityRaw ? String(granularityRaw).toLowerCase() : "raw";
    if (granularity === "second") {
      granularity = "raw";
    }

    if (granularity !== "raw" && granularity !== "minute") {
      return res.status(400).json({
        ok: false,
        error: "granularity 只支援 raw/second 或 minute",
      });
    }

    if (granularity === "minute") {
      const result = await getSharedSensorDataMinuteAgg({
        sensorIds,
        pondIds,
        startDate: startParsed?.value ?? null,
        endDate: endParsed?.value ?? null,
        limit,
        offset,
      });

      return res.json({
        ok: true,
        granularity: "minute",
        data: result.rows,
        count: result.rows.length,
        total: result.total,
        pagination: {
          limit,
          offset,
          total: result.total,
          hasMore: offset + result.rows.length < result.total,
        },
      });
    }

    const result = await getSharedSensorData({
      sensorIds,
      pondIds,
      startDate: startParsed?.value ?? null,
      endDate: endParsed?.value ?? null,
      limit,
      offset,
    });

    return res.json({
      ok: true,
      granularity: "raw",
      data: result.rows,
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
      error: "取得感測器數據失敗",
      detail: err.message,
    });
  }
});

export default router;
