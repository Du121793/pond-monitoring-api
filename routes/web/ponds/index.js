import express from "express";
import passport from "../../../config/passport.js";
import {
  getPondLatestData,
  getLatestSensorData,
  getLatestDailyLog,
  checkPondOwnership,
  getUserPonds,
  createPond,
  updatePond,
  deletePond,
} from "../../../SQL_Controller/index.js";
import dailyLogsRouter from "./daily_logs.js";
import sensorsRouter from "./sensors.js";

const router = express.Router();

// 所有路由都需要 JWT 認證
router.use(passport.authenticate("jwt-web", { session: false }));

router.use("/:pondId/daily-logs", dailyLogsRouter);
router.use("/:pondId/sensors", sensorsRouter);

// 獲取用戶的所有池塘
router.get("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const ponds = await getUserPonds(userId);

    res.json({
      ok: true,
      ponds: ponds,
      count: ponds.length,
    });
  } catch (error) {
    console.error("獲取池塘列表錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "獲取池塘列表失敗",
      detail: error.message,
    });
  }
});

// 獲取特定池塘詳情
router.get("/:pondId", async (req, res) => {
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

    // 獲取池塘詳情
    const ponds = await getUserPonds(userId);
    const pond = ponds.find((p) => p.id == pondId);

    res.json({
      ok: true,
      pond: pond,
    });
  } catch (error) {
    console.error("獲取池塘詳情錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "獲取池塘詳情失敗",
      detail: error.message,
    });
  }
});

// 創建新池塘
router.post("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const {
      pond_name,
      pond_length,
      pond_width,
      pond_height,
      total_fish_count = 0,
      total_fish_weight = 0,
      feeding_growth_rate = 0,
    } = req.body;

    // 驗證必填欄位
    if (!pond_name || !pond_length || !pond_width || !pond_height) {
      return res.status(400).json({
        ok: false,
        error: "池塘名稱、長度、寬度和高度為必填項目",
      });
    }

    // 驗證數值範圍
    if (pond_length <= 0 || pond_width <= 0 || pond_height <= 0) {
      return res.status(400).json({
        ok: false,
        error: "池塘尺寸必須大於0",
      });
    }

    if (feeding_growth_rate < 0 || feeding_growth_rate > 80) {
      return res.status(400).json({
        ok: false,
        error: "餵食成長率必須在0-80%之間",
      });
    }

    const pond = await createPond(userId, {
      pond_name,
      pond_length,
      pond_width,
      pond_height,
      total_fish_count,
      total_fish_weight,
      feeding_growth_rate,
    });

    res.status(201).json({
      ok: true,
      message: "池塘創建成功",
      pond: pond,
    });
  } catch (error) {
    console.error("創建池塘錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "創建池塘失敗",
      detail: error.message,
    });
  }
});

// 更新池塘資訊
router.put("/:pondId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const {
      pond_name,
      pond_length,
      pond_width,
      pond_height,
      total_fish_count,
      total_fish_weight,
      feeding_growth_rate,
    } = req.body;

    // 驗證數值範圍
    if (pond_length !== undefined && pond_length <= 0) {
      return res.status(400).json({
        ok: false,
        error: "池塘長度必須大於0",
      });
    }

    if (pond_width !== undefined && pond_width <= 0) {
      return res.status(400).json({
        ok: false,
        error: "池塘寬度必須大於0",
      });
    }

    if (pond_height !== undefined && pond_height <= 0) {
      return res.status(400).json({
        ok: false,
        error: "池塘高度必須大於0",
      });
    }

    if (
      feeding_growth_rate !== undefined &&
      (feeding_growth_rate < 0 || feeding_growth_rate > 80)
    ) {
      return res.status(400).json({
        ok: false,
        error: "餵食成長率必須在0-80%之間",
      });
    }

    const pond = await updatePond(pondId, userId, {
      pond_name,
      pond_length,
      pond_width,
      pond_height,
      total_fish_count,
      total_fish_weight,
      feeding_growth_rate,
    });

    res.json({
      ok: true,
      message: "池塘更新成功",
      pond: pond,
    });
  } catch (error) {
    console.error("更新池塘錯誤:", error);

    if (error.message === "池塘不存在或您沒有權限修改") {
      return res.status(404).json({
        ok: false,
        error: error.message,
      });
    }

    res.status(500).json({
      ok: false,
      error: "更新池塘失敗",
      detail: error.message,
    });
  }
});

// 刪除池塘
router.delete("/:pondId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;

    const deleted = await deletePond(pondId, userId);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限刪除",
      });
    }

    res.json({
      ok: true,
      message: "池塘刪除成功",
    });
  } catch (error) {
    console.error("刪除池塘錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "刪除池塘失敗",
      detail: error.message,
    });
  }
});

// 獲取池塘最新數據（感測器數據 + 日常記錄）
router.get("/:pondId/latest-data", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;

    // 使用 SQL_controller 的函數獲取完整數據
    const result = await getPondLatestData(pondId, userId);

    res.json({
      ok: true,
      message: "成功獲取池塘最新數據",
      data: {
        pond: result.pond,
        latestSensorData: result.sensorData,
        latestDailyLog: result.dailyLog,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("獲取池塘最新數據錯誤:", error);

    if (error.message === "池塘不存在或您沒有權限訪問") {
      return res.status(404).json({
        ok: false,
        error: error.message,
      });
    }

    res.status(500).json({
      ok: false,
      error: "獲取池塘最新數據失敗",
      detail: error.message,
    });
  }
});

// 獲取池塘最新感測器數據
router.get("/:pondId/latest-sensor-data", async (req, res) => {
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

    // 獲取最新的感測器數據
    const result = await getLatestSensorData(pondId);

    if (!result) {
      return res.status(404).json({
        ok: false,
        error: "該池塘尚無完整的感測器數據",
      });
    }

    res.json({
      ok: true,
      message: "成功獲取池塘最新感測器數據",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("獲取池塘最新感測器數據錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "獲取池塘最新感測器數據失敗",
      detail: error.message,
    });
  }
});

// 獲取池塘最新日常記錄
router.get("/:pondId/latest-daily-log", async (req, res) => {
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

    // 獲取最新的日常記錄
    const result = await getLatestDailyLog(pondId);

    if (!result) {
      return res.status(404).json({
        ok: false,
        error: "該池塘尚無日常記錄",
      });
    }

    res.json({
      ok: true,
      message: "成功獲取池塘最新日常記錄",
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("獲取池塘最新日常記錄錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "獲取池塘最新日常記錄失敗",
      detail: error.message,
    });
  }
});

export default router;
