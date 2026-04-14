import { startAccessCleanupJob } from "./accessCleanup.js";
import { startNotificationOutboxJob } from "./notificationOutbox.js";
import { startWeatherJobs } from "./weather.js";
import { startDailyLogReminderJob } from "./dailyLogReminder.js";

export const startCronJobs = async () => ({
  accessCleanup: startAccessCleanupJob(),
  notificationOutbox: startNotificationOutboxJob(),
  dailyLogReminder: startDailyLogReminderJob(),
  weather: await startWeatherJobs(),
});
