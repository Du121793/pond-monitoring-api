import express from "express";
import {
  checkPondOwnership,
  getPondSensors,
  getSensorById,
  getSensorTokenStatus,
  createSensor,
  updateSensor,
  deleteSensor,
  setSensorTokenHash,
  clearSensorTokenHash,
  hashToken,
} from "../../../SQL_Controller/index.js";
import { createPermanentSensorToken } from "../../../methods/auth.js";

const router = express.Router({ mergeParams: true });

// 獲取池塘的所有感測器
router.get("/", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const userId = req.user.user_id;
    const pondId = req.params.pondId;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    const sensors = await getPondSensors(pondId);
    res.json({
      ok: true,
      sensors,
      count: sensors.length,
    });
  } catch (error) {
    console.error("獲取感測器列表錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "獲取感測器列表失敗",
      detail: error.message,
    });
  }
});

// 獲取特定感測器詳情
router.get("/:sensorId", async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const sensorId = req.params.sensorId;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    const sensor = await getSensorById(pondId, sensorId);
    if (!sensor) {
      return res.status(404).json({
        ok: false,
        error: "感測器不存在",
      });
    }

    res.json({
      ok: true,
      sensor,
    });
  } catch (error) {
    console.error("獲取感測器詳情錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "獲取感測器詳情失敗",
      detail: error.message,
    });
  }
});

// 創建新的感測器（不接受 local_ip）
router.post("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const { sensor_name = null } = req.body || {};

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    const sensor = await createSensor(pondId, { sensor_name });

    res.status(201).json({
      ok: true,
      message: "感測器創建成功",
      sensor,
    });
  } catch (error) {
    console.error("創建感測器錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "創建感測器失敗",
      detail: error.message,
    });
  }
});

// 更新感測器資訊（不接受 local_ip）
router.put("/:sensorId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const sensorId = req.params.sensorId;
    const { sensor_name } = req.body || {};

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    const sensor = await updateSensor(pondId, sensorId, { sensor_name });

    res.json({
      ok: true,
      message: "感測器更新成功",
      sensor,
    });
  } catch (error) {
    console.error("更新感測器錯誤:", error);

    if (error.message === "感測器不存在或您沒有權限修改") {
      return res.status(404).json({
        ok: false,
        error: "感測器不存在",
      });
    }

    res.status(500).json({
      ok: false,
      error: "更新感測器失敗",
      detail: error.message,
    });
  }
});

// 刪除感測器
router.delete("/:sensorId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const sensorId = req.params.sensorId;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    const deleted = await deleteSensor(pondId, sensorId);

    if (!deleted) {
      return res.status(404).json({
        ok: false,
        error: "感測器不存在",
      });
    }

    res.json({
      ok: true,
      message: "感測器刪除成功",
    });
  } catch (error) {
    console.error("刪除感測器錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "刪除感測器失敗",
      detail: error.message,
    });
  }
});

// 生成感測器 token
router.post("/:sensorId/token", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const sensorId = req.params.sensorId;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    const sensor = await getSensorById(pondId, sensorId);
    if (!sensor) {
      return res.status(404).json({
        ok: false,
        error: "感測器不存在",
      });
    }

    const token = createPermanentSensorToken({
      user_id: userId,
      pond_id: pondId,
      sensor_id: sensorId,
    });

    await setSensorTokenHash(sensorId, hashToken(token));

    res.json({
      ok: true,
      message: "感測器 token 生成成功",
      token,
    });
  } catch (error) {
    console.error("生成感測器 token 錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "生成感測器 token 失敗",
      detail: error.message,
    });
  }
});

// 查看感測器 token 狀態
router.get("/:sensorId/token", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const sensorId = req.params.sensorId;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    const status = await getSensorTokenStatus(pondId, sensorId);
    if (!status) {
      return res.status(404).json({
        ok: false,
        error: "感測器不存在",
      });
    }

    const hasToken = !!status.token_hash;
    res.json({
      ok: true,
      data: {
        has_token: hasToken,
        token_issued_at: status.token_issued_at,
        token_revoked_at: status.token_revoked_at,
        is_valid: hasToken,
      },
    });
  } catch (error) {
    console.error("查看感測器 token 狀態錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "查看感測器 token 狀態失敗",
      detail: error.message,
    });
  }
});

// 撤銷感測器 token
router.delete("/:sensorId/token", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const pondId = req.params.pondId;
    const sensorId = req.params.sensorId;

    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    const sensor = await getSensorById(pondId, sensorId);
    if (!sensor) {
      return res.status(404).json({
        ok: false,
        error: "感測器不存在",
      });
    }

    await clearSensorTokenHash(sensorId);

    res.json({
      ok: true,
      message: "感測器 token 已撤銷",
    });
  } catch (error) {
    console.error("撤銷感測器 token 錯誤:", error);
    res.status(500).json({
      ok: false,
      error: "撤銷感測器 token 失敗",
      detail: error.message,
    });
  }
});

export default router;
