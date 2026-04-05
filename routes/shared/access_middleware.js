import {
  consumeAccessKey,
  deleteAccessKeyByHash,
  getAccessKeyStatusByHash,
} from "../../SQL_Controller/access_keys.js";
import { hashAccessKey } from "../../methods/access.js";

const buildAccessError = (status) => {
  if (!status) {
    return "access 無效";
  }
  if (status.revoked_at) {
    return "access 已撤銷";
  }
  if (status.expires_at && new Date(status.expires_at) <= new Date()) {
    return "access 已過期";
  }
  if (Number(status.used_requests) >= Number(status.max_requests)) {
    return "access 已達請求上限";
  }
  return "access 無效";
};

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
