import { processOutboxOnce } from "../methods/notifications/outboxWorker.js";
import { info, error as logError } from "../methods/logger.js";
import { parsePositiveNumberEnv } from "./shared.js";

export const startNotificationOutboxJob = () => {
  const intervalMs = parsePositiveNumberEnv(
    process.env.NOTIFICATION_OUTBOX_INTERVAL_MS,
    10000
  );
  let running = false;

  return setInterval(async () => {
    if (running) {
      return;
    }

    running = true;
    try {
      const result = await processOutboxOnce();
      if (result?.processed) {
        info("通知佇列", `本次處理 ${result.processed} 筆待發送通知`);
      }
    } catch (err) {
      logError("通知佇列", err);
    } finally {
      running = false;
    }
  }, intervalMs);
};
