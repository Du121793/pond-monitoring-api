import express from "express";
import {
  createAccessKeyRecord,
  getAccessKeyById,
  getAccessKeysByUser,
  getSensorsByPondIds,
  getUserPondsByIds,
  getUserSensorsByIds,
  deleteAccessKeyById,
  updateAccessKeyRecord,
} from "../../SQL_Controller/access_keys.js";
import { createAccessKey, getAccessConfig } from "../../methods/access.js";

const router = express.Router();

const parseBodyIdList = (value, fieldName) => {
  if (value === undefined) {
    return { values: undefined };
  }
  if (!Array.isArray(value)) {
    return { error: `${fieldName} 必須為陣列` };
  }
  const values = [];
  for (const item of value) {
    const parsed = Number(item);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return { error: `${fieldName} 只能包含正整數` };
    }
    values.push(parsed);
  }
  return { values: Array.from(new Set(values)) };
};

const buildAccessStatus = (access) => {
  const now = new Date();
  const expired = access.expires_at && new Date(access.expires_at) <= now;
  const revoked = !!access.revoked_at;
  const exhausted = Number(access.used_requests) >= Number(access.max_requests);
  return {
    expired,
    revoked,
    exhausted,
    active: !expired && !revoked && !exhausted,
  };
};

const resolveAccessScope = async ({
  userId,
  sensorIds,
  pondIds,
}) => {
  const normalizedSensorIds = (sensorIds || []).map((id) => Number(id));
  const normalizedPondIds = (pondIds || []).map((id) => Number(id));

  const sensorRows = normalizedSensorIds.length > 0
    ? await getUserSensorsByIds(userId, normalizedSensorIds)
    : [];
  if (normalizedSensorIds.length > 0 && sensorRows.length !== normalizedSensorIds.length) {
    return { error: "包含不存在或無權限的 sensor_id" };
  }

  const pondRows = normalizedPondIds.length > 0
    ? await getUserPondsByIds(userId, normalizedPondIds)
    : [];
  if (normalizedPondIds.length > 0 && pondRows.length !== normalizedPondIds.length) {
    return { error: "包含不存在或無權限的 pond_id" };
  }

  const pondIdsFromSensors = sensorRows.map((row) => Number(row.pond_id));
  const finalPondIds = Array.from(new Set([...normalizedPondIds, ...pondIdsFromSensors]));

  let finalSensorIds = normalizedSensorIds;
  if (normalizedSensorIds.length === 0) {
    const sensorRowsByPond = await getSensorsByPondIds(userId, finalPondIds);
    finalSensorIds = sensorRowsByPond.map((row) => Number(row.id));
  }

  if (finalPondIds.length === 0 && finalSensorIds.length === 0) {
    return { error: "必須指定可用的 pond_id 或 sensor_id" };
  }

  return { pondIds: finalPondIds, sensorIds: finalSensorIds };
};

router.get("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const limitRaw = Number(req.query.limit);
    const offsetRaw = Number(req.query.offset);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, 200)
      : 30;
    const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0
      ? offsetRaw
      : 0;

    const result = await getAccessKeysByUser(userId, { limit, offset });

    res.json({
      ok: true,
      access_keys: result.rows.map((row) => ({
        ...row,
        status: buildAccessStatus(row),
        remaining_requests: Math.max(
          Number(row.max_requests) - Number(row.used_requests),
          0,
        ),
      })),
      count: result.rows.length,
      total: result.total,
      pagination: {
        limit,
        offset,
        total: result.total,
        hasMore: offset + result.rows.length < result.total,
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "取得 access 列表失敗",
      detail: err.message,
    });
  }
});

router.post("/", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const sensorParsed = parseBodyIdList(req.body?.sensor_ids, "sensor_ids");
    if (sensorParsed.error) {
      return res.status(400).json({ ok: false, error: sensorParsed.error });
    }

    const pondParsed = parseBodyIdList(req.body?.pond_ids, "pond_ids");
    if (pondParsed.error) {
      return res.status(400).json({ ok: false, error: pondParsed.error });
    }

    const sensorIds = sensorParsed.values;
    const pondIds = pondParsed.values;

    if (
      (!sensorIds || sensorIds.length === 0) &&
      (!pondIds || pondIds.length === 0)
    ) {
      return res.status(400).json({
        ok: false,
        error: "至少提供 sensor_ids 或 pond_ids",
      });
    }

    const scope = await resolveAccessScope({ userId, sensorIds, pondIds });
    if (scope.error) {
      return res.status(400).json({ ok: false, error: scope.error });
    }

    const config = getAccessConfig();
    const ttlInput = req.body?.expires_in_minutes;
    const maxRequestsInput = req.body?.max_requests;
    const ttlMinutes = ttlInput === undefined ? config.ttlMinutes : Number(ttlInput);
    const maxRequests = maxRequestsInput === undefined
      ? config.maxRequests
      : Number(maxRequestsInput);

    if (!Number.isFinite(ttlMinutes) || ttlMinutes <= 0) {
      return res.status(400).json({ ok: false, error: "expires_in_minutes 必須大於 0" });
    }
    if (!Number.isFinite(maxRequests) || maxRequests <= 0) {
      return res.status(400).json({ ok: false, error: "max_requests 必須大於 0" });
    }

    const { rawKey, hash, preview } = createAccessKey();
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const access = await createAccessKeyRecord({
      userId,
      accessHash: hash,
      accessPreview: preview,
      pondIds: scope.pondIds,
      sensorIds: scope.sensorIds,
      expiresAt,
      maxRequests,
    });

    res.status(201).json({
      ok: true,
      message: "access 建立成功",
      access_key: rawKey,
      access: {
        ...access,
        status: buildAccessStatus(access),
        remaining_requests: Math.max(
          Number(access.max_requests) - Number(access.used_requests),
          0,
        ),
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "建立 access 失敗",
      detail: err.message,
    });
  }
});

router.get("/:accessId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const accessId = Number(req.params.accessId);

    const access = await getAccessKeyById(accessId, userId);
    if (!access) {
      return res.status(404).json({ ok: false, error: "access 不存在" });
    }

    res.json({
      ok: true,
      access: {
        ...access,
        status: buildAccessStatus(access),
        remaining_requests: Math.max(
          Number(access.max_requests) - Number(access.used_requests),
          0,
        ),
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "取得 access 失敗",
      detail: err.message,
    });
  }
});

router.put("/:accessId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const accessId = Number(req.params.accessId);

    const existing = await getAccessKeyById(accessId, userId);
    if (!existing) {
      return res.status(404).json({ ok: false, error: "access 不存在" });
    }

    const sensorParsed = parseBodyIdList(req.body?.sensor_ids, "sensor_ids");
    if (sensorParsed.error) {
      return res.status(400).json({ ok: false, error: sensorParsed.error });
    }
    const pondParsed = parseBodyIdList(req.body?.pond_ids, "pond_ids");
    if (pondParsed.error) {
      return res.status(400).json({ ok: false, error: pondParsed.error });
    }

    const sensorIds = sensorParsed.values !== undefined
      ? sensorParsed.values
      : existing.sensor_ids;
    const pondIds = pondParsed.values !== undefined
      ? pondParsed.values
      : existing.pond_ids;

    const scope = await resolveAccessScope({ userId, sensorIds, pondIds });
    if (scope.error) {
      return res.status(400).json({ ok: false, error: scope.error });
    }

    const ttlMinutes = req.body?.expires_in_minutes;
    const maxRequests = req.body?.max_requests;

    let expiresAt;
    if (ttlMinutes !== undefined) {
      const ttlNumber = Number(ttlMinutes);
      if (!Number.isFinite(ttlNumber) || ttlNumber <= 0) {
        return res.status(400).json({ ok: false, error: "expires_in_minutes 必須大於 0" });
      }
      expiresAt = new Date(Date.now() + ttlNumber * 60 * 1000);
    }

    let maxRequestsValue;
    if (maxRequests !== undefined) {
      const maxNumber = Number(maxRequests);
      if (!Number.isFinite(maxNumber) || maxNumber <= 0) {
        return res.status(400).json({ ok: false, error: "max_requests 必須大於 0" });
      }
      maxRequestsValue = maxNumber;
    }

    const updated = await updateAccessKeyRecord(accessId, userId, {
      pondIds: scope.pondIds,
      sensorIds: scope.sensorIds,
      expiresAt,
      maxRequests: maxRequestsValue,
    });

    res.json({
      ok: true,
      message: "access 更新成功",
      access: {
        ...updated,
        status: buildAccessStatus(updated),
        remaining_requests: Math.max(
          Number(updated.max_requests) - Number(updated.used_requests),
          0,
        ),
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "更新 access 失敗",
      detail: err.message,
    });
  }
});

router.delete("/:accessId", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const accessId = Number(req.params.accessId);

    const deleted = await deleteAccessKeyById(accessId, userId);
    if (!deleted) {
      return res.status(404).json({ ok: false, error: "access 不存在" });
    }

    res.json({ ok: true, message: "access 已刪除" });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "刪除 access 失敗",
      detail: err.message,
    });
  }
});

export default router;
