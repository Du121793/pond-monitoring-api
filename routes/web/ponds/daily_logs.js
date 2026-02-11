import express from "express";
import {
  getPoolRW,
  getTodayDailyLog,
  checkPondOwnership,
  getPondDailyLogs,
  createDailyLog,
  updateDailyLog,
  deleteDailyLog,
} from "../../../SQL_Controller/index.js";

const router = express.Router({ mergeParams: true });

// 獲取池塘的所有日常記錄
router.get("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const { limit = 30, offset = 0, start_date, end_date } = req.query;

    // 檢查池塘權限
    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    // 獲取日常記錄
    const result = await getPondDailyLogs(pondId, {
      limit,
      offset,
      start_date,
      end_date,
    });

    res.json({
      ok: true,
      logs: result.logs,
      count: result.count,
      total: result.total,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error("獲取日常記錄錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "獲取日常記錄失敗",
      detail: error.message,
    });
  }
});

// 獲取池塘今日的日常記錄
router.get("/today", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;

    // 檢查池塘權限
    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    // 獲取今日的日常記錄
    const todayLog = await getTodayDailyLog(pondId);

    if (!todayLog) {
      return res.status(404).json({
        ok: false,
        error: "今日尚無日常記錄",
      });
    }

    res.json({
      ok: true,
      message: "成功獲取今日日常記錄",
      data: todayLog,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("獲取今日日常記錄錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "獲取今日日常記錄失敗",
      detail: error.message,
    });
  }
});

// 獲取特定日常記錄詳情
router.get("/:logId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const logId = req.params.logId;
    const client = await getPoolRW().connect();

    try {
      // 先驗證池塘是否屬於該用戶
      const pondCheck = await client.query(
        "SELECT id FROM ponds WHERE id = $1 AND user_id = $2",
        [pondId, userId]
      );

      if (pondCheck.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          error: "池塘不存在或您沒有權限訪問",
        });
      }

      const result = await client.query(
        `SELECT id, pond_id, feeding_amount, death_count, medication_given,
                medication_type, notes, log_date, created_at, updated_at
         FROM pond_daily_logs 
         WHERE id = $1 AND pond_id = $2`,
        [logId, pondId]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          ok: false,
          error: "日常記錄不存在",
        });
      }

      res.json({
        ok: true,
        log: result.rows[0],
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("獲取日常記錄詳情錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "獲取日常記錄詳情失敗",
      detail: error.message,
    });
  }
});

// 創建新的日常記錄
router.post("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const {
      feeding_amount = 0,
      death_count = 0,
      medication_given = false,
      medication_type = null,
      notes = null,
      log_date,
    } = req.body;

    // 驗證必填欄位
    if (!log_date) {
      return res.status(400).json({
        ok: false,
        error: "記錄日期為必填項目",
      });
    }

    // 驗證數值範圍
    if (feeding_amount < 0) {
      return res.status(400).json({
        ok: false,
        error: "餵養量不能為負數",
      });
    }

    if (death_count < 0) {
      return res.status(400).json({
        ok: false,
        error: "死亡數不能為負數",
      });
    }

    // 檢查池塘權限
    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    // 創建日常記錄
    const log = await createDailyLog(pondId, {
      feeding_amount,
      death_count,
      medication_given,
      medication_type,
      notes,
      log_date,
    });

    res.status(201).json({
      ok: true,
      message: "日常記錄創建成功",
      log: log,
    });
  } catch (error) {
    console.error("創建日常記錄錯誤:", error);

    if (error.message === "該日期已有記錄，每日只能有一筆記錄") {
      return res.status(409).json({
        ok: false,
        error: "該日期已有記錄，請使用更新功能或選擇其他日期",
      });
    }

    res.status(500).json({
      ok: false,
      error: "創建日常記錄失敗",
      detail: error.message,
    });
  }
});

// 更新日常記錄
router.put("/:logId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const logId = req.params.logId;
    const {
      feeding_amount,
      death_count,
      medication_given,
      medication_type,
      notes,
      log_date,
    } = req.body;

    // 驗證數值範圍
    if (feeding_amount !== undefined && feeding_amount < 0) {
      return res.status(400).json({
        ok: false,
        error: "餵養量不能為負數",
      });
    }

    if (death_count !== undefined && death_count < 0) {
      return res.status(400).json({
        ok: false,
        error: "死亡數不能為負數",
      });
    }

    // 檢查池塘權限
    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    // 更新日常記錄
    const log = await updateDailyLog(logId, pondId, {
      feeding_amount,
      death_count,
      medication_given,
      medication_type,
      notes,
      log_date,
    });

    res.json({
      ok: true,
      message: "日常記錄更新成功",
      log: log,
    });
  } catch (error) {
    console.error("更新日常記錄錯誤:", error);

    if (error.message === "記錄不存在或您沒有權限修改") {
      return res.status(404).json({
        ok: false,
        error: "日常記錄不存在",
      });
    }

    if (error.message === "該日期已有其他記錄，每日只能有一筆記錄") {
      return res.status(409).json({
        ok: false,
        error: "該日期已有其他記錄，請選擇其他日期",
      });
    }

    res.status(500).json({
      ok: false,
      error: "更新日常記錄失敗",
      detail: error.message,
    });
  }
});

// 刪除日常記錄
router.delete("/:logId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const logId = req.params.logId;

    // 檢查池塘權限
    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    // 刪除日常記錄
    const deleted = await deleteDailyLog(logId, pondId);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "日常記錄不存在",
      });
    }

    res.json({
      ok: true,
      message: "日常記錄刪除成功",
    });
  } catch (error) {
    console.error("刪除日常記錄錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "刪除日常記錄失敗",
      detail: error.message,
    });
  }
});

export default router;
