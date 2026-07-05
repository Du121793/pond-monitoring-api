import express from "express";
import { checkPondOwnership } from "../../SQL_Controller/index.js";
import {
  AiHelperHttpError,
  deleteAiSession,
  fetchAiHelperHealth,
  fetchAiSessions,
  fetchAiSessionDetail,
  openAiChatStream,
  fetchAiModels,
} from "../../methods/ai_helper.js";
import { info, error as logError } from "../../methods/logger.js";

const router = express.Router();

/**
 * 解析布林值標記。
 * 支援字串 "true"/"false" 或原始布林值。
 */
const parseBooleanFlag = (value, defaultValue) => {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return defaultValue;
};

/**
 * 將 AI Helper 的 HTTP 錯誤對應到 Web API 回應格式。
 */
const mapAiHelperError = (res, err, fallbackMessage) => {
  if (err instanceof AiHelperHttpError) {
    return res.status(err.status).json({
      ok: false,
      error: fallbackMessage,
      detail: err.detail || err.message,
    });
  }

  if (err?.name === "AbortError") {
    return res.status(504).json({
      ok: false,
      error: fallbackMessage,
      detail: "AI Helper 請求逾時",
    });
  }

  return res.status(502).json({
    ok: false,
    error: fallbackMessage,
    detail: err.message,
  });
};

/**
 * 檢查 AI Helper 系統健康狀態。
 */
router.get("/health", async (req, res) => {
  try {
    const data = await fetchAiHelperHealth(req.user.user_id);
    res.json(data);
  } catch (err) {
    logError("web-ai-health", err, req);
    mapAiHelperError(res, err, "AI Helper 健康檢查失敗");
  }
});

/**
 * 獲取可用模型列表。
 * 直接從後端獲取配置清單。
 */
router.get("/models", async (req, res) => {
  try {
    const data = await fetchAiModels(req.user.user_id);
    res.json(data);
  } catch (err) {
    logError("web-ai-models", err, req);
    mapAiHelperError(res, err, "獲取模型列表失敗");
  }
});

/**
 * 列出使用者的對話歷史。
 */
router.get("/sessions", async (req, res) => {
  const parsedLimit = Number(req.query?.limit);
  const limit =
    Number.isInteger(parsedLimit) && parsedLimit > 0
      ? Math.min(parsedLimit, 200)
      : 50;

  try {
    const data = await fetchAiSessions({
      userId: req.user.user_id,
      limit,
    });

    res.json(data);
  } catch (err) {
    logError("web-ai-sessions", err, req);
    mapAiHelperError(res, err, "獲取對話列表失敗");
  }
});

/**
 * 獲取單一對話詳情。
 */
router.get("/sessions/:sessionId", async (req, res) => {
  try {
    const data = await fetchAiSessionDetail({
      userId: req.user.user_id,
      sessionId: req.params.sessionId,
    });

    res.json(data);
  } catch (err) {
    logError("web-ai-session", err, req);
    mapAiHelperError(res, err, "獲取對話詳情失敗");
  }
});

/**
 * 刪除對話紀錄。
 */
router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const data = await deleteAiSession({
      userId: req.user.user_id,
      sessionId: req.params.sessionId,
    });

    res.json(data);
  } catch (err) {
    logError("web-ai-session-delete", err, req);
    mapAiHelperError(res, err, "刪除對話失敗");
  }
});

/**
 * AI 串流聊天 API。
 * 支援多模態附件、深度思考模式與時間窗查詢。
 */
router.post("/chat/stream", async (req, res) => {
  const userId = req.user.user_id;
  const pondId = Number(req.body?.pond_id);
  const sessionId =
    req.body?.session_id === undefined || req.body?.session_id === null
      ? null
      : String(req.body.session_id).trim();
  const message = String(req.body?.message || "").trim();
  const useRag = parseBooleanFlag(req.body?.use_rag, true);
  const enableWebSearch = parseBooleanFlag(
    req.body?.enable_web_search,
    false
  );
  const enableAssistantUi = parseBooleanFlag(
    req.body?.enable_assistant_ui,
    true
  );
  const timeWindowFrom =
    req.body?.time_window_from === undefined ||
    req.body?.time_window_from === null ||
    String(req.body.time_window_from).trim() === ""
      ? null
      : String(req.body.time_window_from).trim();
  const timeWindowTo =
    req.body?.time_window_to === undefined ||
    req.body?.time_window_to === null ||
    String(req.body.time_window_to).trim() === ""
      ? null
      : String(req.body.time_window_to).trim();
  const comparePreviousWindow = parseBooleanFlag(
    req.body?.compare_previous_window,
    false
  );

  // 根據 API 手冊新增的參數
  const model = req.body?.model || process.env.LLM_DEFAULT_MODEL || null;
  const attachments = Array.isArray(req.body?.attachments)
    ? req.body.attachments
    : [];
  const deepThinking = parseBooleanFlag(req.body?.deep_thinking, false);

  if (!Number.isInteger(pondId) || pondId <= 0) {
    return res
      .status(400)
      .json({ ok: false, error: "pond_id 必須為正整數" });
  }

  if (!message) {
    return res
      .status(400)
      .json({ ok: false, error: "訊息內容不能為空" });
  }

  try {
    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

    // 將所有參數透傳給後端，後端會根據模型設定自動過濾 attachments。
    const upstream = await openAiChatStream({
      userId,
      pondId,
      sessionId,
      message,
      useRag,
      enableWebSearch,
      enableAssistantUi,
      timeWindowFrom,
      timeWindowTo,
      comparePreviousWindow,
      model,
      attachments,
      deepThinking,
    });

    info(userId, `AI 串流開始 pond=${pondId} model=${model}`, req.ip);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const closeUpstream = () => {
      upstream.abort();
      upstream.response.destroy?.();
    };

    req.on("close", closeUpstream);

    try {
      for await (const chunk of upstream.response) {
        res.write(chunk);
      }
      res.end();
    } catch (err) {
      logError("web-ai-stream", err, req);
      if (!res.headersSent) {
        mapAiHelperError(res, err, "AI 串流失敗");
      } else {
        res.write(
          `event: error\ndata: ${JSON.stringify({
            message: "AI 串流中斷，請稍後再試。",
          })}\n\n`
        );
        res.end();
      }
    } finally {
      req.off("close", closeUpstream);
      upstream.cleanup();
    }
  } catch (err) {
    logError("web-ai-stream", err, req);
    mapAiHelperError(res, err, "AI 串流請求失敗");
  }
});

export default router;
