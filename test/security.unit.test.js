const assert = require('node:assert/strict');
const { test } = require('node:test');
const { csrfProtection, issueCsrfToken } = require('../middleware/csrf');
const {
  normalizeIdentity,
  normalizeName,
  validateRegistration,
} = require('../utils/authValidation');
const { clearRefreshCookies, getRefreshCookieOptions } = require('../utils/token');
const { validateEnvironment } = require('../config/env');
const { generateRoomCode, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH } = require('../utils/roomCode');

test('registration validation accepts strong credentials and rejects unsafe boundaries', () => {
  const valid = {
    name: 'Test Person',
    username: 'test_user',
    email: 'person@example.com',
    password: 'Correct-Horse-7',
  };
  assert.equal(validateRegistration(valid), null);

  for (const patch of [
    { username: 'x' },
    { username: 'bad user' },
    { email: 'invalid' },
    { password: 'Short1!' },
    { password: 'alllowercasepassword' },
    { password: 'A1!'.repeat(25) },
    { name: 'x'.repeat(81) },
  ]) {
    assert.ok(validateRegistration({ ...valid, ...patch }));
  }
});

test('account identifiers and display names normalize consistently', () => {
  assert.equal(normalizeIdentity(' User@Example.COM '), 'user@example.com');
  assert.equal(normalizeName('  Test   Person '), 'Test Person');
});

test('room codes use the cryptographically secure restricted alphabet', () => {
  const codes = Array.from({ length: 200 }, () => generateRoomCode());
  const allowed = new RegExp(`^[${ROOM_CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

  assert.ok(codes.every((code) => allowed.test(code)));
  assert.equal(new Set(codes).size, codes.length);
});

test('CSRF middleware requires matching well-formed cookie and header tokens', () => {
  const token = 'a'.repeat(64);
  let passed = false;
  csrfProtection(
    { cookies: { csrf_token: token }, get: () => token },
    { status: () => assert.fail('valid token rejected') },
    () => {
      passed = true;
    }
  );
  assert.equal(passed, true);

  let status;
  csrfProtection(
    { cookies: { csrf_token: token }, get: () => 'invalid' },
    {
      status(value) {
        status = value;
        return this;
      },
      json() {},
    },
    () => assert.fail('invalid token accepted')
  );
  assert.equal(status, 403);
});

test('CSRF and refresh cookies use restricted auth paths', () => {
  const cookies = [];
  issueCsrfToken(
    {},
    {
      cookie: (...args) => cookies.push(args),
      json: (body) => body,
    }
  );
  assert.match(cookies[0][1], /^[a-f0-9]{64}$/);
  assert.equal(cookies[0][2].path, '/api/auth');
  assert.equal(cookies[0][2].httpOnly, true);
  assert.equal(getRefreshCookieOptions().path, '/api/auth');

  const cleared = [];
  clearRefreshCookies({ clearCookie: (...args) => cleared.push(args) });
  assert.deepEqual(
    cleared.map(([, options]) => options.path),
    ['/api/auth', '/api/auth/refresh']
  );
});

test('production environment validation rejects missing and unsafe configuration', () => {
  assert.throws(
    () => validateEnvironment({ NODE_ENV: 'production' }),
    (err) => err.code === 'INVALID_ENVIRONMENT' && err.message.includes('DATABASE_URL')
  );

  assert.throws(
    () =>
      validateEnvironment({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://database/pomodoro',
        JWT_SECRET: 'same-secret-that-is-long-enough-123',
        REFRESH_TOKEN_SECRET: 'same-secret-that-is-long-enough-123',
        CORS_ORIGINS: 'http://insecure.example.com/path',
        REFRESH_COOKIE_SECURE: 'false',
      }),
    (err) =>
      err.message.includes('must be different') &&
      err.message.includes('HTTPS origin') &&
      err.message.includes('must be Secure')
  );
});

test('production environment validation accepts a complete secure configuration', () => {
  assert.doesNotThrow(() =>
    validateEnvironment({
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://database.example.com/pomodoro',
      JWT_SECRET: 'access-secret-that-is-at-least-32-bytes',
      REFRESH_TOKEN_SECRET: 'refresh-secret-that-is-at-least-32-bytes',
      CORS_ORIGINS: 'https://pomodoro.example.com',
      REFRESH_COOKIE_SECURE: 'true',
      METRICS_TOKEN: 'metrics-secret-that-is-at-least-32-bytes',
      SENTRY_TRACES_SAMPLE_RATE: '0.1',
    })
  );
});
