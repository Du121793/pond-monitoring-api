import express from "express";
import {
  DAILY_LOG_ERRORS,
  createDailyLogOption,
  getDailyLogOptions,
  updateDailyLogOption,
} from "../../SQL_Controller/index.js";

const router = express.Router();

const mapOptionError = (res, error) => {
  switch (error.message) {
    case DAILY_LOG_ERRORS.OPTION_NAME_REQUIRED:
      return res.status(400).json({
        ok: false,
        error: "選項名稱不能為空",
      });
    case DAILY_LOG_ERRORS.OPTION_INVALID_CATEGORY:
      return res.status(400).json({
        ok: false,
        error: "選項分類無效",
      });
    case DAILY_LOG_ERRORS.OPTION_NOT_FOUND:
      return res.status(404).json({
        ok: false,
        error: "找不到指定的自訂選項",
      });
    default:
      return null;
  }
};

router.get("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const category = req.query.category || undefined;
    const options = await getDailyLogOptions(userId, { category });

    return res.json({
      ok: true,
      options,
      count: options.length,
    });
  } catch (error) {
    const mapped = mapOptionError(res, error);
    if (mapped) {
      return mapped;
    }

    return res.status(500).json({
      ok: false,
      error: "取得每日紀錄選項失敗",
      detail: error.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const option = await createDailyLogOption(userId, {
      category: req.body.category,
      name: req.body.name,
      default_unit: req.body.default_unit,
    });

    return res.status(201).json({
      ok: true,
      message: "自訂選項建立成功",
      option,
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "同分類下已存在相同名稱的自訂選項",
      });
    }

    const mapped = mapOptionError(res, error);
    if (mapped) {
      return mapped;
    }

    return res.status(500).json({
      ok: false,
      error: "建立自訂選項失敗",
      detail: error.message,
    });
  }
});

router.patch("/:optionId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const option = await updateDailyLogOption(userId, req.params.optionId, {
      name: req.body.name,
      default_unit: req.body.default_unit,
      is_active: req.body.is_active,
    });

    return res.json({
      ok: true,
      message: "自訂選項更新成功",
      option,
    });
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({
        ok: false,
        error: "同分類下已存在相同名稱的自訂選項",
      });
    }

    const mapped = mapOptionError(res, error);
    if (mapped) {
      return mapped;
    }

    return res.status(500).json({
      ok: false,
      error: "更新自訂選項失敗",
      detail: error.message,
    });
  }
});

export default router;
