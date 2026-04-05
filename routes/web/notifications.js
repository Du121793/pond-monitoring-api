import express from "express";
import {
  upsertPushSubscription,
  disablePushSubscription,
  createNotificationOutbox,
} from "../../SQL_Controller/notifications.js";

const router = express.Router();

router.post("/subscribe", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const subscription = req.body?.subscription;
    const deviceLabel = req.body?.device_label;
    const userAgent = req.headers["user-agent"] || null;

    if (!subscription) {
      return res.status(400).json({ ok: false, error: "subscription required" });
    }

    const saved = await upsertPushSubscription({
      userId,
      subscription,
      userAgent,
      deviceLabel,
    });

    return res.status(201).json({
      ok: true,
      message: "subscription saved",
      subscription: {
        id: saved.id,
        endpoint: saved.endpoint,
        status: saved.status,
      },
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "failed to save subscription",
      detail: err.message,
    });
  }
});

router.post("/unsubscribe", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const endpoint = req.body?.subscription?.endpoint;

    if (!endpoint) {
      return res.status(400).json({ ok: false, error: "endpoint required" });
    }

    const updated = await disablePushSubscription(userId, endpoint);
    if (!updated) {
      return res.status(404).json({ ok: false, error: "subscription not found" });
    }

    return res.json({ ok: true, message: "subscription disabled" });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "failed to disable subscription",
      detail: err.message,
    });
  }
});

router.post("/test", async (req, res) => {
  try {
    const userId = req.user.user_id;
    const delayRaw = req.body?.delay_seconds;
    const delaySeconds = delayRaw === undefined ? 0 : Number(delayRaw);

    if (!Number.isFinite(delaySeconds) || delaySeconds < 0 || delaySeconds > 3600) {
      return res.status(400).json({
        ok: false,
        error: "delay_seconds must be between 0 and 3600",
      });
    }

    const title = req.body?.title?.trim() || "Test Notification";
    const body = req.body?.body?.trim() || "This is a test message.";
    const url = req.body?.url || null;
    const requireInteraction = !!req.body?.require_interaction;

    const payload = {
      title,
      body,
      tag: `test-${Date.now()}`,
      requireInteraction,
      data: {
        type: "test_notification",
        url,
      },
    };

    const nextRetryAt = delaySeconds > 0
      ? new Date(Date.now() + delaySeconds * 1000)
      : null;

    const outbox = await createNotificationOutbox({
      eventId: null,
      userId,
      payload,
      nextRetryAt,
    });

    return res.status(201).json({
      ok: true,
      message: "test notification scheduled",
      outbox_id: outbox.id,
      send_after: nextRetryAt || new Date(),
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "failed to schedule test notification",
      detail: err.message,
    });
  }
});

export default router;
