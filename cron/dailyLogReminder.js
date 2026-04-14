import { CronJob } from "cron";
import { getPondsMissingDailyLog } from "../SQL_Controller/daily_logs.js";
import {
  upsertGrafanaAlertEvent,
  createNotificationOutbox,
  markGrafanaAlertEnqueued,
  getActiveSubscriptionsByUser,
} from "../SQL_Controller/notifications.js";
import { info, error as logError } from "../methods/logger.js";
import { getTaipeiDateString } from "./shared.js";

const buildReminderPayload = ({ pondId, pondName, targetDate }) => ({
  title: "每日紀錄提醒",
  body: `${pondName} 在 ${targetDate} 尚未新增每日紀錄。`,
  tag: `daily-log-reminder-${pondId}-${targetDate}`,
  requireInteraction: true,
  data: {
    type: "daily_log_reminder",
    pondId,
    date: targetDate,
    url: `/web/ponds/${pondId}/daily_logs`,
  },
});

export const runDailyLogReminderOnce = async () => {
  const targetDate = getTaipeiDateString();
  const ponds = await getPondsMissingDailyLog(targetDate);
  let enqueued = 0;
  let skipped = 0;

  for (const pond of ponds) {
    const subscriptions = await getActiveSubscriptionsByUser(pond.user_id);
    if (!subscriptions.length) {
      skipped += 1;
      continue;
    }

    const fingerprint = `daily-log-reminder:${pond.pond_id}:${targetDate}`;
    const event = await upsertGrafanaAlertEvent({
      source: "daily_log_reminder",
      ruleUid: "daily_log_missing_18_00",
      fingerprint,
      status: "firing",
      severity: "warning",
      pondId: pond.pond_id,
      userId: pond.user_id,
      labels: {
        category: "daily_log_reminder",
        reminder_date: targetDate,
      },
      annotations: {
        summary: "尚未新增每日紀錄",
        description: `${pond.pond_name} 在 ${targetDate} 尚未新增每日紀錄。`,
      },
      startsAt: new Date(),
      endsAt: null,
    });

    if (event?.last_enqueued_at) {
      skipped += 1;
      continue;
    }

    await createNotificationOutbox({
      eventId: event.id,
      userId: pond.user_id,
      payload: buildReminderPayload({
        pondId: pond.pond_id,
        pondName: pond.pond_name,
        targetDate,
      }),
    });
    await markGrafanaAlertEnqueued(event.id);
    enqueued += 1;
  }

  info(
    "每日紀錄提醒",
    `${targetDate} 檢查完成，共檢查 ${ponds.length} 個池塘，已排入 ${enqueued} 筆通知，略過 ${skipped} 筆`
  );

  return { targetDate, checked: ponds.length, enqueued, skipped };
};

export const startDailyLogReminderJob = () => {
  const job = new CronJob(
    "0 0 18 * * *",
    () =>
      runDailyLogReminderOnce().catch((err) =>
        logError("每日紀錄提醒", err)
      ),
    null,
    true,
    "Asia/Taipei"
  );

  info("每日紀錄提醒", "每日 18:00 每日紀錄提醒排程已啟動");
  return job;
};
