const crypto = require('crypto');
const RateLimit = require('../models/rateLimit');

function digest(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

async function incrementCounter({ key, windowStart, expiresAt }) {
  return RateLimit.increment({ key, windowStart, expiresAt });
}

function createRateLimit({ scope, windowMs, max, keyGenerator = clientIp }) {
  if (!scope || !Number.isFinite(windowMs) || !Number.isFinite(max)) {
    throw new TypeError('Invalid rate-limit configuration');
  }

  return async function rateLimit(req, res, next) {
    try {
      const now = Date.now();
      const windowStartMs = Math.floor(now / windowMs) * windowMs;
      const windowStart = new Date(windowStartMs);
      const expiresAt = new Date(windowStartMs + windowMs * 2);
      const key = `${scope}:${digest(keyGenerator(req))}`;

      const record = await incrementCounter({ key, windowStart, expiresAt });

      const resetSeconds = Math.ceil((windowStartMs + windowMs - now) / 1000);
      res.set('RateLimit-Limit', String(max));
      res.set('RateLimit-Remaining', String(Math.max(0, max - record.count)));
      res.set('RateLimit-Reset', String(resetSeconds));

      if (record.count > max) {
        res.set('Retry-After', String(resetSeconds));
        return res.status(429).json({ message: 'Too many requests. Please try again later.' });
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { createRateLimit, clientIp };
