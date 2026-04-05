import { getAccessConfig } from "../../methods/access.js";

export const parseIdList = (value) => {
  if (value === undefined || value === null || value === "") {
    return { values: null };
  }

  const raw = Array.isArray(value) ? value.join(",") : String(value);
  const parts = raw.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return { values: [] };
  }

  const values = [];
  for (const part of parts) {
    const parsed = Number(part);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { error: "ID 格式錯誤，必須為正整數" };
    }
    values.push(parsed);
  }

  return { values: Array.from(new Set(values)) };
};

export const ensureAllowedIds = (requestedIds, allowedIds) => {
  const allowedSet = new Set((allowedIds || []).map((id) => Number(id)));
  if (!requestedIds || requestedIds.length === 0) {
    return Array.from(allowedSet);
  }
  for (const id of requestedIds) {
    if (!allowedSet.has(Number(id))) {
      return null;
    }
  }
  return requestedIds;
};

export const parseLimitOffset = (limitRaw, offsetRaw) => {
  const config = getAccessConfig();
  const defaultLimit = config.dataDefaultLimit ?? 50;
  const maxLimit = config.dataMaxLimit ?? 200;

  const limitParsed = Number(limitRaw);
  const offsetParsed = Number(offsetRaw);

  const limit = Number.isInteger(limitParsed) && limitParsed > 0
    ? Math.min(limitParsed, maxLimit)
    : defaultLimit;
  const offset = Number.isInteger(offsetParsed) && offsetParsed >= 0
    ? offsetParsed
    : 0;

  return { limit, offset, maxLimit };
};

export const parseDateString = (value) => {
  if (!value) {
    return null;
  }
  const str = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return { error: "日期格式錯誤，請使用 YYYY-MM-DD" };
  }
  return { value: str };
};
