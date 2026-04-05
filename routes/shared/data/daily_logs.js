import express from "express";
import { getSharedDailyLogs } from "../../../SQL_Controller/shared_data.js";
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
    const allowedPondIds = (access.pond_ids || []).map((id) => Number(id));

    const combined = [];
    if (req.query.pond_id) combined.push(req.query.pond_id);
    if (req.query.pond_ids) combined.push(req.query.pond_ids);
    const pondParsed = parseIdList(combined.length ? combined.join(",") : null);
    if (pondParsed.error) {
      return res.status(400).json({ ok: false, error: pondParsed.error });
    }

    const pondIds = ensureAllowedIds(pondParsed.values, allowedPondIds);
    if (!pondIds) {
      return res.status(403).json({ ok: false, error: "pond_id 不在允許範圍內" });
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

    const result = await getSharedDailyLogs({
      pondIds,
      startDate: startParsed?.value ?? null,
      endDate: endParsed?.value ?? null,
      limit,
      offset,
    });

    res.json({
      ok: true,
      logs: result.rows,
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
      error: "取得日常記錄失敗",
      detail: err.message,
    });
  }
});

export default router;
