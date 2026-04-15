import express from "express";
import {
  DAILY_LOG_ERRORS,
  checkPondOwnership,
  getPondDailyLogs,
  getTodayDailyLog,
  getDailyLogById,
  createDailyLog,
  updateDailyLog,
  deleteDailyLog,
} from "../../../SQL_Controller/index.js";

const router = express.Router({ mergeParams: true });

const buildErrorResponse = (res, error) => {
  switch (error.message) {
    case DAILY_LOG_ERRORS.DUPLICATE:
      return res.status(409).json({
        ok: false,
        error: "同一個池塘在同一天只能有一筆每日紀錄",
      });
    case DAILY_LOG_ERRORS.NOT_FOUND:
      return res.status(404).json({
        ok: false,
        error: "找不到指定的每日紀錄",
      });
    case DAILY_LOG_ERRORS.INVALID_CATEGORY:
      return res.status(400).json({
        ok: false,
        error: "投入項目的分類無效",
      });
    case DAILY_LOG_ERRORS.CATEGORY_MISMATCH:
      return res.status(400).json({
        ok: false,
        error: "投入項目的分類與選項庫不一致",
      });
    case DAILY_LOG_ERRORS.INVALID_DOSAGE:
      return res.status(400).json({
        ok: false,
        error: "劑量必須是大於或等於 0 的數值",
      });
    case DAILY_LOG_ERRORS.ITEM_NAME_REQUIRED:
      return res.status(400).json({
        ok: false,
        error: "投入項目名稱不能為空",
      });
    case DAILY_LOG_ERRORS.CATALOG_NOT_FOUND:
    case DAILY_LOG_ERRORS.INVALID_CATALOG_ID:
      return res.status(400).json({
        ok: false,
        error: "投入項目選項不存在或無權使用",
      });
    default:
      return null;
  }
};

const validateBaseFields = (body, { requireLogDate = false } = {}) => {
  const { log_date, feeding_amount, death_count, items } = body;

  if (requireLogDate && !log_date) {
    return "log_date 為必填欄位";
  }

  if (
    feeding_amount !== undefined &&
    (!Number.isFinite(Number(feeding_amount)) || Number(feeding_amount) < 0)
  ) {
    return "feeding_amount 必須是大於或等於 0 的數值";
  }

  if (
    death_count !== undefined &&
    (!Number.isInteger(Number(death_count)) || Number(death_count) < 0)
  ) {
    return "death_count 必須是大於或等於 0 的整數";
  }

  if (items !== undefined && !Array.isArray(items)) {
    return "items 必須是陣列";
  }

  return null;
};

router.get("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const { limit = 30, offset = 0, start_date, end_date } = req.query;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({ ok: false, error: "找不到指定的池塘" });
    }

    const result = await getPondDailyLogs(pondId, {
      limit,
      offset,
      start_date,
      end_date,
    });

    return res.json({
      ok: true,
      logs: result.logs,
      count: result.count,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "取得每日紀錄失敗",
      detail: error.message,
    });
  }
});

router.get("/today", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({ ok: false, error: "找不到指定的池塘" });
    }

    const todayLog = await getTodayDailyLog(pondId);
    if (!todayLog) {
      return res.status(404).json({ ok: false, error: "今天尚未建立每日紀錄" });
    }

    return res.json({
      ok: true,
      data: todayLog,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "取得今日每日紀錄失敗",
      detail: error.message,
    });
  }
});

router.get("/:logId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const logId = req.params.logId;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({ ok: false, error: "找不到指定的池塘" });
    }

    const log = await getDailyLogById(logId, pondId);
    if (!log) {
      return res.status(404).json({ ok: false, error: "找不到指定的每日紀錄" });
    }

    return res.json({ ok: true, log });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "取得單筆每日紀錄失敗",
      detail: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;

    const validationError = validateBaseFields(req.body, { requireLogDate: true });
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({ ok: false, error: "找不到指定的池塘" });
    }

    const log = await createDailyLog(pondId, userId, {
      feeding_amount:
        req.body.feeding_amount === undefined
          ? 0
          : Number(req.body.feeding_amount),
      death_count:
        req.body.death_count === undefined ? 0 : Number(req.body.death_count),
      notes: req.body.notes ?? null,
      log_date: req.body.log_date,
      items: req.body.items,
      medication_type: req.body.medication_type,
    });

    return res.status(201).json({
      ok: true,
      message: "每日紀錄建立成功",
      log,
    });
  } catch (error) {
    const mapped = buildErrorResponse(res, error);
    if (mapped) {
      return mapped;
    }

    return res.status(500).json({
      ok: false,
      error: "建立每日紀錄失敗",
      detail: error.message,
    });
  }
});

router.put("/:logId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const logId = req.params.logId;

    const validationError = validateBaseFields(req.body);
    if (validationError) {
      return res.status(400).json({ ok: false, error: validationError });
    }

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({ ok: false, error: "找不到指定的池塘" });
    }

    const log = await updateDailyLog(logId, pondId, userId, {
      feeding_amount:
        req.body.feeding_amount === undefined
          ? undefined
          : Number(req.body.feeding_amount),
      death_count:
        req.body.death_count === undefined
          ? undefined
          : Number(req.body.death_count),
      notes: req.body.notes,
      log_date: req.body.log_date,
      items: req.body.items,
      medication_type: req.body.medication_type,
    });

    return res.json({
      ok: true,
      message: "每日紀錄更新成功",
      log,
    });
  } catch (error) {
    const mapped = buildErrorResponse(res, error);
    if (mapped) {
      return mapped;
    }

    return res.status(500).json({
      ok: false,
      error: "更新每日紀錄失敗",
      detail: error.message,
    });
  }
});

router.delete("/:logId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const logId = req.params.logId;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({ ok: false, error: "找不到指定的池塘" });
    }

    const deleted = await deleteDailyLog(logId, pondId);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "找不到指定的每日紀錄" });
    }

    return res.json({
      ok: true,
      message: "每日紀錄刪除成功",
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: "刪除每日紀錄失敗",
      detail: error.message,
    });
  }
});

export default router;
