import { fetchCombinedAt, fetchCombinedLatest, isModelServiceUnavailableError } from "../methods/modelResponseClient.js";
import { info, error as logError } from "../methods/logger.js";
import { listAllPondIds, upsertForecastPredictions, upsertRiskPredictions } from "../SQL_Controller/predictions.js";
import { parsePositiveNumberEnv } from "./shared.js";

const PREDICTION_SYNC_ENABLED = String(process.env.PREDICTION_SYNC_ENABLED || "true").toLowerCase() !== "false";
const LOOKBACK_HOURS = parsePositiveNumberEnv(process.env.PREDICTION_LOOKBACK_HOURS, 240);
const BACKFILL_DAYS = parsePositiveNumberEnv(process.env.PREDICTION_BACKFILL_DAYS, 7);
const BACKFILL_INTERVAL_MINUTES = parsePositiveNumberEnv(process.env.PREDICTION_BACKFILL_INTERVAL_MINUTES, 30);
const LIVE_INTERVAL_MS = parsePositiveNumberEnv(process.env.PREDICTION_SYNC_INTERVAL_MS, 30000);

let backfillRunning = false;
let liveRunning = false;

const floorToInterval = (date, minutes) => {
  const next = new Date(date);
  next.setSeconds(0, 0);
  const currentMinutes = next.getMinutes();
  next.setMinutes(currentMinutes - (currentMinutes % minutes));
  return next;
};

const buildBackfillSlots = () => {
  const end = floorToInterval(new Date(), BACKFILL_INTERVAL_MINUTES);
  const start = new Date(end.getTime() - BACKFILL_DAYS * 24 * 60 * 60 * 1000);
  const slots = [];
  for (let current = new Date(start); current <= end; current = new Date(current.getTime() + BACKFILL_INTERVAL_MINUTES * 60 * 1000)) {
    slots.push(new Date(current));
  }
  return slots;
};

const toTaipeiRiskDate = (isoString) => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const baseDate = new Date(isoString);
  const plusOne = new Date(baseDate.getTime() + 24 * 60 * 60 * 1000);
  return formatter.format(plusOne);
};

const persistCombinedPrediction = async ({ pondId, predictionTs, payload }) => {
  const sourceFeatureTs = payload?.ts ?? null;
  const data = payload;
  await upsertForecastPredictions({
    pondId,
    predictionTs,
    sourceFeatureTs,
    forecast: data.forecast,
    modelVersions: data.model_versions,
  });
  await upsertRiskPredictions({
    pondId,
    predictionTs,
    sourceFeatureTs,
    risk: data.risk,
    riskScore: data.risk_score,
    modelVersions: data.model_versions,
    riskForDate: toTaipeiRiskDate(predictionTs),
  });
};

const logPredictionFailure = (scope, pondId, predictionTs, err) => {
  logError(scope, err, {
    body: {
      pondId,
      predictionTs,
    },
  });
};

export const runPredictionBackfillOnce = async () => {
  if (!PREDICTION_SYNC_ENABLED || backfillRunning) {
    return { skipped: true };
  }
  backfillRunning = true;
  try {
    const pondIds = await listAllPondIds();
    const slots = buildBackfillSlots();
    let processed = 0;
    let failed = 0;
    let serviceUnavailable = false;

    for (const pondId of pondIds) {
      if (serviceUnavailable) break;
      for (const slot of slots) {
        if (serviceUnavailable) break;
        const predictionTs = slot.toISOString();
        try {
          const response = await fetchCombinedAt({ pondId, predictionAt: predictionTs, lookbackHours: LOOKBACK_HOURS });
          await persistCombinedPrediction({ pondId, predictionTs, payload: response.data });
          processed += 1;
        } catch (err) {
          failed += 1;
          if (isModelServiceUnavailableError(err)) {
            serviceUnavailable = true;
            info("prediction-sync", `model service unavailable during backfill; aborting remaining slots after pond=${pondId} ts=${predictionTs}`);
            break;
          }
          logPredictionFailure("prediction backfill slot", pondId, predictionTs, err);
        }
      }
    }

    info("prediction-sync", `backfill completed ponds=${pondIds.length} slots=${slots.length} processed=${processed} failed=${failed} serviceUnavailable=${serviceUnavailable}`);
    return { ponds: pondIds.length, slots: slots.length, processed, failed, serviceUnavailable };
  } catch (err) {
    logError("prediction backfill fatal", err);
    return { ok: false, failed: true, error: err.message };
  } finally {
    backfillRunning = false;
  }
};

export const runPredictionLiveOnce = async () => {
  if (!PREDICTION_SYNC_ENABLED || liveRunning) {
    return { skipped: true };
  }
  liveRunning = true;
  try {
    const pondIds = await listAllPondIds();
    let processed = 0;
    let failed = 0;
    let serviceUnavailable = false;

    for (const pondId of pondIds) {
      const predictionTs = new Date().toISOString();
      try {
        const response = await fetchCombinedLatest({ pondId, lookbackHours: LOOKBACK_HOURS });
        await persistCombinedPrediction({ pondId, predictionTs, payload: response.data });
        processed += 1;
      } catch (err) {
        failed += 1;
        if (isModelServiceUnavailableError(err)) {
          serviceUnavailable = true;
          info("prediction-sync", `model service unavailable during live sync; aborting remaining ponds after pond=${pondId}`);
          break;
        }
        logPredictionFailure("prediction live pond", pondId, predictionTs, err);
      }
    }

    info("prediction-sync", `live sync completed ponds=${pondIds.length} processed=${processed} failed=${failed} serviceUnavailable=${serviceUnavailable}`);
    return { ponds: pondIds.length, processed, failed, serviceUnavailable };
  } catch (err) {
    logError("prediction live sync fatal", err);
    return { ok: false, failed: true, error: err.message };
  } finally {
    liveRunning = false;
  }
};

export const startPredictionSyncJob = async () => {
  if (!PREDICTION_SYNC_ENABLED) {
    info("prediction-sync", "prediction sync disabled by env");
    return null;
  }

  info("prediction-sync", `starting prediction sync backfillDays=${BACKFILL_DAYS} backfillIntervalMinutes=${BACKFILL_INTERVAL_MINUTES} liveIntervalMs=${LIVE_INTERVAL_MS}`);

  try {
    await runPredictionBackfillOnce();
  } catch (err) {
    logError("prediction backfill startup", err);
  }

  try {
    await runPredictionLiveOnce();
  } catch (err) {
    logError("prediction live startup", err);
  }

  return setInterval(() => {
    runPredictionLiveOnce().catch((err) => logError("prediction live interval", err));
  }, LIVE_INTERVAL_MS);
};
