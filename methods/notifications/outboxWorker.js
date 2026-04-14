import {
  getPendingNotificationOutbox,
  getActiveSubscriptionsByUser,
  updateNotificationOutboxAttempt,
  markGrafanaAlertNotified,
} from "../../SQL_Controller/notifications.js";
import { error as logError } from "../logger.js";
import { isPushServiceReady, sendPushNotification } from "./pushService.js";

const parseNumberEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const getRetryDelaySeconds = (attempts) => {
  const base = 60;
  const maxDelay = 3600;
  const exponent = Math.min(attempts, 5);
  return Math.min(base * Math.pow(2, exponent), maxDelay);
};

export const processOutboxOnce = async () => {
  if (!isPushServiceReady()) {
    return { skipped: true, reason: "push-not-ready" };
  }

  const batchSize = parseNumberEnv(process.env.NOTIFICATION_OUTBOX_BATCH, 50);
  const items = await getPendingNotificationOutbox(batchSize);

  for (const item of items) {
    try {
      const subscriptions = await getActiveSubscriptionsByUser(item.user_id);
      if (!subscriptions.length) {
        await updateNotificationOutboxAttempt({
          id: item.id,
          status: "failed",
          lastError: "no-active-subscriptions",
          nextRetryAt: null,
          sentAt: null,
        });
        continue;
      }

      let successCount = 0;
      let retryableErrors = 0;

      for (const subscription of subscriptions) {
        const result = await sendPushNotification(subscription, item.payload);
        if (result.ok) {
          successCount += 1;
        } else if (!result.invalid) {
          retryableErrors += 1;
        }
      }

      if (successCount > 0) {
        await updateNotificationOutboxAttempt({
          id: item.id,
          status: "sent",
          lastError: null,
          nextRetryAt: null,
          sentAt: new Date(),
        });
        if (item.event_id) {
          await markGrafanaAlertNotified(item.event_id);
        }
        continue;
      }

      if (retryableErrors > 0) {
        const delaySeconds = getRetryDelaySeconds(item.attempts + 1);
        const nextRetryAt = new Date(Date.now() + delaySeconds * 1000);
        await updateNotificationOutboxAttempt({
          id: item.id,
          status: "pending",
          lastError: "push-failed",
          nextRetryAt,
          sentAt: null,
        });
        continue;
      }

      await updateNotificationOutboxAttempt({
        id: item.id,
        status: "failed",
        lastError: "all-subscriptions-invalid",
        nextRetryAt: null,
        sentAt: null,
      });
    } catch (err) {
      logError("outbox-worker", err);
    }
  }

  return { processed: items.length };
};
