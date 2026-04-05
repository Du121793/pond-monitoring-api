BEGIN;

-- Push Subscriptions
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id               BIGSERIAL PRIMARY KEY,
  user_id          BIGINT NOT NULL REFERENCES users(id),
  endpoint         TEXT NOT NULL UNIQUE,
  p256dh           TEXT NOT NULL,
  auth             TEXT NOT NULL,
  user_agent       TEXT,
  device_label     TEXT,
  status           TEXT NOT NULL DEFAULT 'active',
  failure_count    INTEGER NOT NULL DEFAULT 0,
  last_seen_at     TIMESTAMPTZ,
  last_failure_at  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active
  ON push_subscriptions (user_id)
  WHERE status = 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_push_subscriptions' AND c.relname = 'push_subscriptions'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_push_subscriptions
             BEFORE UPDATE ON push_subscriptions
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Grafana Alert Events
CREATE TABLE IF NOT EXISTS grafana_alert_events (
  id               BIGSERIAL PRIMARY KEY,
  source           TEXT NOT NULL DEFAULT 'grafana',
  rule_uid         TEXT,
  fingerprint      TEXT NOT NULL,
  status           TEXT NOT NULL,
  severity         TEXT,
  pond_id          BIGINT,
  user_id          BIGINT,
  labels           JSONB NOT NULL,
  annotations      JSONB,
  starts_at        TIMESTAMPTZ,
  ends_at          TIMESTAMPTZ,
  last_enqueued_at TIMESTAMPTZ,
  last_notified_at TIMESTAMPTZ,
  notify_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_grafana_alert_events_status
  ON grafana_alert_events (status);

CREATE INDEX IF NOT EXISTS idx_grafana_alert_events_user
  ON grafana_alert_events (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE t.tgname = 'set_updated_at_grafana_alert_events' AND c.relname = 'grafana_alert_events'
  ) THEN
    EXECUTE 'CREATE TRIGGER set_updated_at_grafana_alert_events
             BEFORE UPDATE ON grafana_alert_events
             FOR EACH ROW
             EXECUTE FUNCTION trg_set_updated_at()';
  END IF;
END $$;

-- Notification Outbox
CREATE TABLE IF NOT EXISTS notification_outbox (
  id                BIGSERIAL PRIMARY KEY,
  event_id          BIGINT REFERENCES grafana_alert_events(id),
  user_id           BIGINT NOT NULL REFERENCES users(id),
  payload           JSONB NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending',
  attempts          INTEGER NOT NULL DEFAULT 0,
  last_attempted_at TIMESTAMPTZ,
  next_retry_at     TIMESTAMPTZ,
  sent_at           TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
  ON notification_outbox (next_retry_at)
  WHERE status = 'pending';

COMMIT;
