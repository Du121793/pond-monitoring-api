import crypto from "crypto";
import { readFileSync } from "fs";
import { error as logError } from "./logger.js";

const accessConfig = {
  ttlMinutes: 30,
  maxRequests: 200,
  dataDefaultLimit: 50,
  dataMaxLimit: 200,
};

try {
  const appConfig = JSON.parse(
    readFileSync(new URL("../config/app-config.json", import.meta.url), "utf8"),
  );
  if (Number.isFinite(appConfig?.access?.ttlMinutes)) {
    accessConfig.ttlMinutes = appConfig.access.ttlMinutes;
  }
  if (Number.isFinite(appConfig?.access?.maxRequests)) {
    accessConfig.maxRequests = appConfig.access.maxRequests;
  }
  if (Number.isFinite(appConfig?.access?.dataDefaultLimit)) {
    accessConfig.dataDefaultLimit = appConfig.access.dataDefaultLimit;
  }
  if (Number.isFinite(appConfig?.access?.dataMaxLimit)) {
    accessConfig.dataMaxLimit = appConfig.access.dataMaxLimit;
  }
} catch (err) {
  logError("access-config", err);
}

export const getAccessConfig = () => ({ ...accessConfig });

export const hashAccessKey = (rawKey) => {
  if (!rawKey) {
    throw new Error("access key is required");
  }
  return crypto.createHash("sha256").update(rawKey).digest("hex");
};

export const createAccessKey = () => {
  const rawKey = crypto.randomBytes(32).toString("hex");
  const hash = hashAccessKey(rawKey);
  const preview = rawKey.slice(-6);
  return { rawKey, hash, preview };
};
