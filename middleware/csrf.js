const crypto = require('crypto');
const { getRefreshCookieOptions } = require('../utils/token');

const CSRF_COOKIE = 'csrf_token';

function csrfCookieOptions() {
  const refreshOptions = getRefreshCookieOptions();
  return {
    httpOnly: true,
    secure: refreshOptions.secure,
    sameSite: refreshOptions.sameSite,
    domain: refreshOptions.domain,
    path: '/api/auth',
    maxAge: 24 * 60 * 60 * 1000,
  };
}

function issueCsrfToken(req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
  return res.json({ csrfToken: token });
}

function csrfProtection(req, res, next) {
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('X-CSRF-Token');
  const tokenPattern = /^[a-f0-9]{64}$/;

  if (!tokenPattern.test(cookieToken || '') || !tokenPattern.test(headerToken || '')) {
    return res.status(403).json({ message: 'Invalid CSRF token' });
  }

  const valid = crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  if (!valid) return res.status(403).json({ message: 'Invalid CSRF token' });
  return next();
}

module.exports = { issueCsrfToken, csrfProtection };
