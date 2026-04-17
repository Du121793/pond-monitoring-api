import express from "express";
import { checkPondOwnership } from "../../SQL_Controller/index.js";
import {
  AiHelperHttpError,
  deleteAiSession,
  fetchAiHelperHealth,
  fetchAiSessions,
  fetchAiSessionDetail,
  openAiChatStream,
} from "../../methods/ai_helper.js";
import { info, error as logError } from "../../methods/logger.js";

const router = express.Router();

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
      detail: "AI Helper request timed out",
    });
  }

  return res.status(502).json({
    ok: false,
    error: fallbackMessage,
    detail: err.message,
  });
};

router.get("/health", async (req, res) => {
  try {
    const data = await fetchAiHelperHealth(req.user.user_id);
    res.json(data);
  } catch (err) {
    logError("web-ai-health", err, req);
    mapAiHelperError(res, err, "AI Helper health check failed");
  }
});

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
    mapAiHelperError(res, err, "AI session list fetch failed");
  }
});

router.get("/sessions/:sessionId", async (req, res) => {
  try {
    const data = await fetchAiSessionDetail({
      userId: req.user.user_id,
      sessionId: req.params.sessionId,
    });

    res.json(data);
  } catch (err) {
    logError("web-ai-session", err, req);
    mapAiHelperError(res, err, "AI session fetch failed");
  }
});

router.delete("/sessions/:sessionId", async (req, res) => {
  try {
    const data = await deleteAiSession({
      userId: req.user.user_id,
      sessionId: req.params.sessionId,
    });

    res.json(data);
  } catch (err) {
    logError("web-ai-session-delete", err, req);
    mapAiHelperError(res, err, "AI session delete failed");
  }
});

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

  if (!Number.isInteger(pondId) || pondId <= 0) {
    return res
      .status(400)
      .json({ ok: false, error: "pond_id must be a positive integer" });
  }

  if (!message) {
    return res
      .status(400)
      .json({ ok: false, error: "message is required" });
  }

  try {
    const hasAccess = await checkPondOwnership(pondId, userId);
    if (!hasAccess) {
      return res.status(404).json({
        ok: false,
        error: "池塘不存在或您沒有權限訪問",
      });
    }

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
    });

    info(userId, `AI 串流開始 pond=${pondId}`, req.ip);

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
        mapAiHelperError(res, err, "AI stream failed");
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
    mapAiHelperError(res, err, "AI stream failed");
  }
});

export default router;
