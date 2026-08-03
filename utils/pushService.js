const webpush = require('web-push');
const PushSubscription = require('../models/pushSubscription');
const logger = require('./logger');

function isConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configureWebPush() {
  if (!isConfigured()) return false;

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  return true;
}

function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || '';
}

function notificationForState(doc) {
  if (doc.mode === 'focus') {
    return {
      title: 'Time to focus',
      body: 'Your break is over. Start the next focus segment.',
    };
  }

  return {
    title: doc.isLongBreak ? 'Long break time' : 'Break time',
    body: doc.isLongBreak
      ? 'Focus segment complete. Take a longer break.'
      : 'Focus segment complete. Take a short break.',
  };
}

async function sendToUser(userId, payload) {
  if (!configureWebPush()) return { skipped: true, sent: 0 };

  const subscriptions = await PushSubscription.find({ user: userId }).lean();
  let sent = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          JSON.stringify(payload)
        );
        sent += 1;
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await PushSubscription.deleteOne({ endpoint: sub.endpoint });
          return;
        }
        logger.error({ err }, 'Push send failed');
      }
    })
  );

  return { skipped: false, sent };
}

async function sendSegmentCompletePushes(userId, pendingSessions, doc) {
  const completed = pendingSessions.filter((session) => session.completed);
  if (!completed.length) return;

  const payload = {
    ...notificationForState(doc),
    url: '/',
    nextMode: doc.mode,
    timestamp: new Date().toISOString(),
  };

  try {
    await sendToUser(userId, payload);
  } catch (err) {
    logger.error({ err }, 'Push notification error');
  }
}

module.exports = {
  getPublicKey,
  isConfigured,
  sendSegmentCompletePushes,
};
