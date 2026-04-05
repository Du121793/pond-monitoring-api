import express from "express";
import crypto from "crypto";
import {
  upsertGrafanaAlertEvent,
  markGrafanaAlertEnqueued,
  createNotificationOutbox,
} from "../../SQL_Controller/notifications.js";
import { getPondOwnerId } from "../../SQL_Controller/ponds.js";
import { info } from "../../methods/logger.js";

const router = express.Router();

const resolveToken = (req) => {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }
  return req.headers["x-grafana-token"] || null;
};

const toDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const parseLabelNumber = (labels, keys) => {
  for (const key of keys) {
    if (labels?.[key] !== undefined) {
      const parsed = Number(labels[key]);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
};

const normalizeAlert = (alert, fallbackStatus) => {
  const labels = alert?.labels || {};
  const annotations = alert?.annotations || {};
  const status = alert?.status || fallbackStatus || "firing";
  const fingerprintSeed = JSON.stringify({
    labels,
    annotations,
    status,
    alertName: alert?.alertName || labels?.alertname || null,
  });
  const fingerprint = alert?.fingerprint
    || crypto.createHash("sha256").update(fingerprintSeed).digest("hex");
  const ruleUid = labels.rule_uid || labels.__rule_uid__ || labels.ruleUid || null;
  const severity = labels.severity || labels.level || labels.alert_severity || null;
  const pondId = parseLabelNumber(labels, ["pond_id", "pondId", "pond"]);
  const userId = parseLabelNumber(labels, ["user_id", "userId"]);
  const startsAt = toDate(alert?.startsAt || alert?.starts_at);
  const endsAt = toDate(alert?.endsAt || alert?.ends_at);

  return {
    status,
    fingerprint,
    ruleUid,
    severity,
    pondId,
    userId,
    labels,
    annotations,
    startsAt,
    endsAt,
    generatorURL: alert?.generatorURL || null,
  };
};

const buildPayload = ({ status, labels, annotations, fingerprint, pondId, severity, ruleUid, generatorURL }) => {
  const title = annotations.summary
    || annotations.title
    || labels.alertname
    || "Grafana alert";
  const body = annotations.description
    || annotations.message
    || `${labels.alertname || "Alert"} is ${status}`;
  const url = annotations.url || generatorURL || null;

  return {
    title,
    body,
    tag: `grafana-${fingerprint}`,
    requireInteraction: status === "firing" && severity === "critical",
    data: {
      type: "grafana_alert",
      status,
      fingerprint,
      pondId,
      ruleUid,
      severity,
      url,
    },
  };
};

router.post("/", async (req, res) => {
  const expectedToken = process.env.GRAFANA_WEBHOOK_TOKEN;
  if (expectedToken) {
    const token = resolveToken(req);
    if (!token || token !== expectedToken) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }
  }

  const payload = req.body || {};
  const alerts = Array.isArray(payload.alerts) ? payload.alerts : [payload];
  const cooldownMinutes = Number(process.env.GRAFANA_ALERT_COOLDOWN_MINUTES) || 30;
  const notifyResolved = String(process.env.GRAFANA_NOTIFY_RESOLVED || "false") === "true";

  let enqueued = 0;
  let skipped = 0;

  for (const alert of alerts) {
    const normalized = normalizeAlert(alert, payload.status);
    if (!normalized.fingerprint) {
      skipped += 1;
      continue;
    }

    let userId = normalized.userId;
    if (!userId && normalized.pondId) {
      userId = await getPondOwnerId(normalized.pondId);
    }
    if (!userId) {
      skipped += 1;
      continue;
    }

    const event = await upsertGrafanaAlertEvent({
      ruleUid: normalized.ruleUid,
      fingerprint: normalized.fingerprint,
      status: normalized.status,
      severity: normalized.severity,
      pondId: normalized.pondId,
      userId,
      labels: normalized.labels,
      annotations: normalized.annotations,
      startsAt: normalized.startsAt,
      endsAt: normalized.endsAt,
    });

    const now = Date.now();
    const lastEnqueued = event?.last_enqueued_at
      ? new Date(event.last_enqueued_at).getTime()
      : null;
    const cooldownPassed = !lastEnqueued
      || now - lastEnqueued >= cooldownMinutes * 60 * 1000;

    if (normalized.status === "firing" && cooldownPassed) {
      const notificationPayload = buildPayload({
        ...normalized,
        generatorURL: alert?.generatorURL || normalized.generatorURL,
      });
      await createNotificationOutbox({
        eventId: event.id,
        userId,
        payload: notificationPayload,
      });
      await markGrafanaAlertEnqueued(event.id);
      enqueued += 1;
      continue;
    }

    if (normalized.status === "resolved" && notifyResolved) {
      const notificationPayload = buildPayload({
        ...normalized,
        generatorURL: alert?.generatorURL || normalized.generatorURL,
      });
      await createNotificationOutbox({
        eventId: event.id,
        userId,
        payload: notificationPayload,
      });
      await markGrafanaAlertEnqueued(event.id);
      enqueued += 1;
      continue;
    }
  }

  info("grafana-webhook", `received ${alerts.length}, enqueued ${enqueued}`);
  return res.json({ ok: true, received: alerts.length, enqueued, skipped });
});

export default router;
