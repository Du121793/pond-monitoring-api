import { pool_RW, pool_RO } from "./db_connect.js";

export const upsertPushSubscription = async ({
  userId,
  subscription,
  userAgent,
  deviceLabel,
}) => {
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error("invalid subscription payload");
  }

  const query = `
    INSERT INTO push_subscriptions (
      user_id, endpoint, p256dh, auth, user_agent, device_label,
      status, failure_count, last_seen_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      'active', 0, NOW()
    )
    ON CONFLICT (endpoint) DO UPDATE
    SET user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth = EXCLUDED.auth,
        user_agent = EXCLUDED.user_agent,
        device_label = EXCLUDED.device_label,
        status = 'active',
        failure_count = 0,
        last_seen_at = NOW(),
        updated_at = NOW()
    RETURNING *
  `;

  const values = [userId, endpoint, p256dh, auth, userAgent, deviceLabel];
  const { rows } = await pool_RW.query(query, values);
  return rows[0];
};

export const disablePushSubscription = async (userId, endpoint) => {
  const query = `
    UPDATE push_subscriptions
    SET status = 'disabled', updated_at = NOW()
    WHERE user_id = $1 AND endpoint = $2
    RETURNING *
  `;
  const { rows } = await pool_RW.query(query, [userId, endpoint]);
  return rows[0] || null;
};

export const markPushSubscriptionFailed = async (endpoint) => {
  const query = `
    UPDATE push_subscriptions
    SET status = 'disabled',
        failure_count = failure_count + 1,
        last_failure_at = NOW(),
        updated_at = NOW()
    WHERE endpoint = $1
    RETURNING *
  `;
  const { rows } = await pool_RW.query(query, [endpoint]);
  return rows[0] || null;
};

export const getActiveSubscriptionsByUser = async (userId) => {
  const query = `
    SELECT *
    FROM push_subscriptions
    WHERE user_id = $1 AND status = 'active'
    ORDER BY updated_at DESC
  `;
  const { rows } = await pool_RO.query(query, [userId]);
  return rows;
};

export const upsertGrafanaAlertEvent = async ({
  source = "grafana",
  ruleUid,
  fingerprint,
  status,
  severity,
  pondId,
  userId,
  labels,
  annotations,
  startsAt,
  endsAt,
}) => {
  const query = `
    INSERT INTO grafana_alert_events (
      source, rule_uid, fingerprint, status, severity,
      pond_id, user_id, labels, annotations, starts_at, ends_at
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11
    )
    ON CONFLICT (source, fingerprint) DO UPDATE
    SET rule_uid = COALESCE(EXCLUDED.rule_uid, grafana_alert_events.rule_uid),
        status = EXCLUDED.status,
        severity = COALESCE(EXCLUDED.severity, grafana_alert_events.severity),
        pond_id = COALESCE(EXCLUDED.pond_id, grafana_alert_events.pond_id),
        user_id = COALESCE(EXCLUDED.user_id, grafana_alert_events.user_id),
        labels = EXCLUDED.labels,
        annotations = COALESCE(EXCLUDED.annotations, grafana_alert_events.annotations),
        starts_at = COALESCE(EXCLUDED.starts_at, grafana_alert_events.starts_at),
        ends_at = COALESCE(EXCLUDED.ends_at, grafana_alert_events.ends_at),
        updated_at = NOW()
    RETURNING *
  `;
  const values = [
    source,
    ruleUid,
    fingerprint,
    status,
    severity,
    pondId,
    userId,
    labels,
    annotations,
    startsAt,
    endsAt,
  ];
  const { rows } = await pool_RW.query(query, values);
  return rows[0];
};

export const markGrafanaAlertEnqueued = async (eventId) => {
  const query = `
    UPDATE grafana_alert_events
    SET last_enqueued_at = NOW(), updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool_RW.query(query, [eventId]);
  return rows[0] || null;
};

export const markGrafanaAlertNotified = async (eventId) => {
  const query = `
    UPDATE grafana_alert_events
    SET last_notified_at = NOW(),
        notify_count = notify_count + 1,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `;
  const { rows } = await pool_RW.query(query, [eventId]);
  return rows[0] || null;
};

export const createNotificationOutbox = async ({
  eventId,
  userId,
  payload,
  nextRetryAt,
}) => {
  const query = `
    INSERT INTO notification_outbox (
      event_id, user_id, payload, status, next_retry_at
    ) VALUES (
      $1, $2, $3, 'pending', $4
    )
    RETURNING *
  `;
  const { rows } = await pool_RW.query(query, [
    eventId,
    userId,
    payload,
    nextRetryAt || null,
  ]);
  return rows[0];
};

export const getPendingNotificationOutbox = async (limit) => {
  const query = `
    SELECT *
    FROM notification_outbox
    WHERE status = 'pending'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY created_at ASC
    LIMIT $1
  `;
  const { rows } = await pool_RO.query(query, [limit]);
  return rows;
};

export const updateNotificationOutboxAttempt = async ({
  id,
  status,
  lastError,
  nextRetryAt,
  sentAt,
}) => {
  const query = `
    UPDATE notification_outbox
    SET status = $2,
        attempts = attempts + 1,
        last_attempted_at = NOW(),
        last_error = $3,
        next_retry_at = $4,
        sent_at = $5
    WHERE id = $1
    RETURNING *
  `;
  const values = [id, status, lastError, nextRetryAt, sentAt];
  const { rows } = await pool_RW.query(query, values);
  return rows[0] || null;
};
