import webpush from "web-push";
import { info, error as logError } from "../logger.js";
import { markPushSubscriptionFailed } from "../../SQL_Controller/notifications.js";

let pushReady = false;

export const initializePushService = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const rawContact = process.env.VAPID_CONTACT || "mailto:admin@example.com";
  const contact = rawContact.includes(":")
    ? rawContact
    : `mailto:${rawContact}`;

  if (!publicKey || !privateKey) {
    info("push", "VAPID keys missing, push disabled");
    pushReady = false;
    return false;
  }

  webpush.setVapidDetails(contact, publicKey, privateKey);
  pushReady = true;
  info("push", "VAPID configured");
  return true;
};

export const isPushServiceReady = () => pushReady;

export const sendPushNotification = async (subscription, payload) => {
  if (!pushReady) {
    throw new Error("push service not initialized");
  }

  const pushSubscription = {
    endpoint: subscription.endpoint,
    keys: {
      p256dh: subscription.p256dh,
      auth: subscription.auth,
    },
  };

  try {
    await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      try {
        await markPushSubscriptionFailed(subscription.endpoint);
      } catch (updateErr) {
        logError("push-disable", updateErr);
      }
      return { ok: false, invalid: true, error: err };
    }
    return { ok: false, error: err };
  }
};
