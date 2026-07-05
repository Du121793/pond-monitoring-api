import { startAccessCleanupJob } from "./accessCleanup.js";
import { startNotificationOutboxJob } from "./notificationOutbox.js";
import { startWeatherJobs } from "./weather.js";
import { startDailyLogReminderJob } from "./dailyLogReminder.js";
import { startPredictionSyncJob } from "./predictionSync.js";
import { error as logError } from "../methods/logger.js";

export const startCronJobs = async () => {
  let weather = null;
  let predictionSync = null;

  try {
    weather = await startWeatherJobs();
  } catch (err) {
    logError("start weather jobs", err);
  }

  try {
    predictionSync = await startPredictionSyncJob();
  } catch (err) {
    logError("start prediction sync job", err);
  }

  return {
    accessCleanup: startAccessCleanupJob(),
    notificationOutbox: startNotificationOutboxJob(),
    dailyLogReminder: startDailyLogReminderJob(),
    weather,
    predictionSync,
  };
};
