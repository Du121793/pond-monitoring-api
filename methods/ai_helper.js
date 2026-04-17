import { createAiHelperToken } from "./auth.js";
import http from "node:http";
import https from "node:https";

const getBaseUrl = () =>
  (process.env.AI_HELPER_BASE_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");

const getJsonTimeoutMs = () => {
  const parsed = Number(process.env.AI_HELPER_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000;
};

const buildHeaders = (userId, extraHeaders = {}) => ({
  Authorization: `Bearer ${createAiHelperToken({ user_id: userId })}`,
  ...extraHeaders,
});

const buildUrl = (path) => `${getBaseUrl()}${path}`;

const readResponseTextSafely = async (response) => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

const parseJsonSafely = async (response) => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

export class AiHelperHttpError extends Error {
  constructor(status, message, detail = null) {
    super(message);
    this.name = "AiHelperHttpError";
    this.status = status;
    this.detail = detail;
  }
}

const buildAbortController = (timeoutMs) => {
  const controller = new AbortController();
  const timeoutId =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;

  return {
    controller,
    clear: () => {
      if (timeoutId !== null) {
        clearTimeout(timeoutId);
      }
    },
  };
};

export const fetchAiHelperHealth = async (userId) => {
  const { controller, clear } = buildAbortController(getJsonTimeoutMs());

  try {
    const response = await fetch(buildUrl("/api/system/health"), {
      method: "GET",
      headers: buildHeaders(userId),
      signal: controller.signal,
    });

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new AiHelperHttpError(
        response.status,
        data?.detail || "AI Helper health check failed",
        data
      );
    }

    return data;
  } finally {
    clear();
  }
};

export const fetchAiSessionDetail = async ({ userId, sessionId }) => {
  const { controller, clear } = buildAbortController(getJsonTimeoutMs());

  try {
    const response = await fetch(
      buildUrl(`/api/ai/sessions/${encodeURIComponent(sessionId)}`),
      {
        method: "GET",
        headers: buildHeaders(userId),
        signal: controller.signal,
      }
    );

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new AiHelperHttpError(
        response.status,
        data?.detail || "AI session fetch failed",
        data
      );
    }

    return data;
  } finally {
    clear();
  }
};

export const fetchAiSessions = async ({ userId, limit = 50 }) => {
  const { controller, clear } = buildAbortController(getJsonTimeoutMs());

  try {
    const response = await fetch(
      buildUrl(`/api/ai/sessions?limit=${encodeURIComponent(limit)}`),
      {
        method: "GET",
        headers: buildHeaders(userId),
        signal: controller.signal,
      }
    );

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new AiHelperHttpError(
        response.status,
        data?.detail || "AI session list fetch failed",
        data
      );
    }

    return data;
  } finally {
    clear();
  }
};

export const deleteAiSession = async ({ userId, sessionId }) => {
  const { controller, clear } = buildAbortController(getJsonTimeoutMs());

  try {
    const response = await fetch(
      buildUrl(`/api/ai/sessions/${encodeURIComponent(sessionId)}`),
      {
        method: "DELETE",
        headers: buildHeaders(userId),
        signal: controller.signal,
      }
    );

    const data = await parseJsonSafely(response);
    if (!response.ok) {
      throw new AiHelperHttpError(
        response.status,
        data?.detail || "AI session delete failed",
        data
      );
    }

    return data;
  } finally {
    clear();
  }
};

export const openAiChatStream = async ({
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
}) => {
  const url = new URL(buildUrl("/api/ai/chat/stream"));
  const transport = url.protocol === "https:" ? https : http;
  const body = JSON.stringify({
    pond_id: pondId,
    session_id: sessionId,
    message,
    use_rag: useRag,
    enable_web_search: enableWebSearch,
    enable_assistant_ui: enableAssistantUi,
    time_window_from: timeWindowFrom,
    time_window_to: timeWindowTo,
    compare_previous_window: comparePreviousWindow,
  });

  return await new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || (url.protocol === "https:" ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        method: "POST",
        headers: {
          ...buildHeaders(userId, {
            "Content-Type": "application/json",
          }),
          "Content-Length": Buffer.byteLength(body),
        },
      },
      (response) => {
        const status = response.statusCode || 502;

        if (status < 200 || status >= 300) {
          const chunks = [];
          response.on("data", (chunk) => chunks.push(chunk));
          response.on("end", () => {
            const detail = Buffer.concat(chunks).toString("utf8");
            reject(
              new AiHelperHttpError(
                status,
                detail || "AI stream request failed",
                detail || null
              )
            );
          });
          response.on("error", reject);
          return;
        }

        resolve({
          response,
          abort: () => request.destroy(),
          cleanup: () => {},
        });
      }
    );

    request.on("error", reject);
    request.write(body);
    request.end();
  });
};
