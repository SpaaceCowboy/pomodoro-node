const assert = require('node:assert/strict');
const { test } = require('node:test');
const { csrfProtection, issueCsrfToken } = require('../middleware/csrf');
const {
  normalizeIdentity,
  normalizeName,
  validateRegistration,
} = require('../utils/authValidation');
const { clearRefreshCookies, getRefreshCookieOptions } = require('../utils/token');

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
