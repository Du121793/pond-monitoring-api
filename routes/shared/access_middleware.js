import {
  consumeAccessKey,
  deleteAccessKeyByHash,
  getAccessKeyStatusByHash,
} from "../../SQL_Controller/access_keys.js";
import { hashAccessKey } from "../../methods/access.js";

const buildAccessError = (status) => {
  if (!status) {
    return "access 不存在";
  }
  if (status.revoked_at) {
    return "access 已撤銷";
  }
  if (status.expires_at && new Date(status.expires_at) <= new Date()) {
    return "access 已過期";
  }
  if (Number(status.used_requests) >= Number(status.max_requests)) {
    return "access 已達最大請求次數";
  }
  return "access 不存在";
};

const hasUsableAccessScope = (access) =>
  (Array.isArray(access?.pond_ids) && access.pond_ids.length > 0)
  || (Array.isArray(access?.sensor_ids) && access.sensor_ids.length > 0);

export const requireAccessKey = async (req, res, next) => {
  try {
    const accessParam = req.query.access;
    if (!accessParam || Array.isArray(accessParam)) {
      return res.status(401).json({
        ok: false,
        error: "缺少 access 參數",
      });
    }

    const accessHash = hashAccessKey(accessParam);
    const access = await consumeAccessKey(accessHash);
    if (!access) {
      const status = await getAccessKeyStatusByHash(accessHash);
      if (status?.expires_at && new Date(status.expires_at) <= new Date()) {
        await deleteAccessKeyByHash(accessHash);
      }
      return res.status(403).json({
        ok: false,
        error: buildAccessError(status),
      });
    }

    if (!hasUsableAccessScope(access)) {
      await deleteAccessKeyByHash(accessHash);
      return res.status(403).json({
        ok: false,
        error: "access 已無有效 scope",
      });
    }

    req.access = access;
    next();
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "access 驗證失敗",
      detail: err.message,
    });
  }
};
