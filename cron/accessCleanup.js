import { deleteExpiredAccessKeys } from "../SQL_Controller/access_keys.js";
import { error as logError } from "../methods/logger.js";
import { parsePositiveNumberEnv } from "./shared.js";

export const startAccessCleanupJob = () => {
  const intervalMs = parsePositiveNumberEnv(
    process.env.ACCESS_KEY_CLEANUP_INTERVAL_MS,
    10 * 60 * 1000
  );

  return setInterval(async () => {
    try {
      await deleteExpiredAccessKeys();
    } catch (err) {
      logError("存取金鑰清理", err);
    }
  }, intervalMs);
};
