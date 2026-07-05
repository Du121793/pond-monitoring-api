import { error as logError } from "./logger.js";

const DEFAULT_SERVICE_URL = "http://127.0.0.1:8010";
const REQUEST_TIMEOUT_MS = Number(process.env.MODEL_RESPONSE_TIMEOUT_MS) || 30000;

const buildUrl = (path) => `${process.env.MODEL_RESPONSE_SERVICE_URL || DEFAULT_SERVICE_URL}${path}`;

const markAvailabilityError = (err) => {
  const code = err?.cause?.code || err?.code;
  const httpStatus = Number(err?.httpStatus);
  const serviceUnavailableCodes = new Set(["ECONNREFUSED", "ECONNRESET", "ENOTFOUND", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "ABORT_ERR"]);
  const isFetchFailure = err?.name === "AbortError" || String(err?.message || "").includes("fetch failed");
  const isServiceHttpFailure = Number.isFinite(httpStatus) && httpStatus >= 500;
  if (serviceUnavailableCodes.has(code) || isFetchFailure || isServiceHttpFailure) {
    err.modelServiceUnavailable = true;
  }
  return err;
};

const postJson = async (path, payload) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(buildUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const rawText = await response.text();
    let parsed = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = { rawText };
    }

    if (!response.ok) {
      const err = new Error(`model-response-service ${path} failed: ${response.status} ${response.statusText} body=${JSON.stringify(parsed)}`);
      err.httpStatus = response.status;
      throw err;
    }

    return parsed;
  } catch (err) {
    const finalErr = markAvailabilityError(err);
    logError("model-response-client", finalErr, { body: payload });
    throw finalErr;
  } finally {
    clearTimeout(timeoutId);
  }
};

export const isModelServiceUnavailableError = (err) => !!err?.modelServiceUnavailable;

export const fetchCombinedLatest = async ({ pondId, lookbackHours = 240 }) =>
  postJson("/api/predict/combined/latest", {
    pond_id: pondId,
    lookback_hours: lookbackHours,
  });

export const fetchCombinedAt = async ({ pondId, predictionAt, lookbackHours = 240 }) =>
  postJson("/api/predict/combined/at", {
    pond_id: pondId,
    prediction_at: predictionAt,
    lookback_hours: lookbackHours,
  });
