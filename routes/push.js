const express = require('express');
const auth = require('../middleware/auth');
const PushSubscription = require('../models/pushSubscription');
const { getPublicKey, isConfigured } = require('../utils/pushService');

const router = express.Router();

function sanitizeSubscription(subscription) {
  if (!subscription || typeof subscription !== 'object') return null;
  const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint : '';
  const keys = subscription.keys || {};
  const p256dh = typeof keys.p256dh === 'string' ? keys.p256dh : '';
  const auth = typeof keys.auth === 'string' ? keys.auth : '';

  if (!endpoint || !p256dh || !auth) return null;

  return {
    endpoint,
    keys: { p256dh, auth },
  };
}

router.get('/vapid-key', auth, (req, res) => {
  if (!isConfigured()) {
    return res.status(503).json({ message: 'Push notifications are not configured' });
  }

  res.json({ publicKey: getPublicKey() });
});

router.post('/subscribe', auth, async (req, res, next) => {
  try {
    const subscription = sanitizeSubscription(req.body.subscription);
    if (!subscription) {
      return res.status(400).json({ message: 'Invalid push subscription' });
    }

    const doc = await PushSubscription.upsert({
      user: req.user.id,
      endpoint: subscription.endpoint,
      keys: subscription.keys,
      userAgent: req.headers['user-agent'] || '',
    });

    res.status(201).json({ subscribed: true, id: doc._id });
  } catch (err) {
    next(err);
  }
});

router.delete('/subscribe', auth, async (req, res, next) => {
  try {
    const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : '';
    if (!endpoint) {
      return res.status(400).json({ message: 'Subscription endpoint is required' });
    }

    await PushSubscription.remove({ userId: req.user.id, endpoint });
    res.json({ subscribed: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
