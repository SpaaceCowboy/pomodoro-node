const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const mongoose = require('mongoose');
const request = require('supertest');

const hasTestDatabase = Boolean(process.env.TEST_MONGODB_URI);
let app;
let agent;
let csrfToken;
let accessToken;

before(async () => {
  if (!hasTestDatabase) return;
  process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
  process.env.JWT_SECRET = 'test-access-secret-with-sufficient-entropy';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-with-sufficient-entropy';
  process.env.NODE_ENV = 'test';
  process.env.VERCEL = '1';
  process.env.CORS_ORIGINS = 'http://localhost:3002';

  app = require('../server');
  await app.ready;
  agent = request.agent(app);
});

after(async () => {
  if (!hasTestDatabase) return;
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('health endpoint is available', { skip: !hasTestDatabase }, async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
});

test('protected endpoints reject missing access tokens', { skip: !hasTestDatabase }, async () => {
  await request(app).get('/api/profile/me').expect(401);
  await request(app).get('/api/timer/state').expect(401);
});

test('auth mutations reject requests without CSRF proof', { skip: !hasTestDatabase }, async () => {
  await request(app)
    .post('/api/auth/login')
    .send({ email: 'person@example.com', password: 'Correct-Horse-7' })
    .expect(403);
});

test(
  'registration validates credentials and creates a session',
  { skip: !hasTestDatabase },
  async () => {
    const csrf = await agent.get('/api/auth/csrf').expect(200);
    csrfToken = csrf.body.csrfToken;
    assert.match(csrfToken, /^[a-f0-9]{64}$/);

    await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({ username: 'x', email: 'invalid', password: 'short' })
      .expect(400);

    const response = await agent
      .post('/api/auth/register')
      .set('X-CSRF-Token', csrfToken)
      .send({
        name: 'Test Person',
        username: 'Test_User',
        email: 'Person@Example.com',
        password: 'Correct-Horse-7',
      })
      .expect(201);

    accessToken = response.body.accessToken;
    assert.ok(accessToken);
    assert.equal(response.body.user.username, 'test_user');
    assert.equal(response.body.user.email, 'person@example.com');
  }
);

test(
  'access tokens authorize profile and persistent timer state',
  { skip: !hasTestDatabase },
  async () => {
    const profile = await agent
      .get('/api/profile/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    assert.equal(profile.body.user.username, 'test_user');

    await agent
      .post('/api/timer/start')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ label: 'Integration test' })
      .expect(200);

    const state = await agent
      .get('/api/timer/state')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    assert.equal(state.body.isRunning, true);
  }
);

test(
  'refresh rotates the database token and logout revokes the active token',
  { skip: !hasTestDatabase },
  async () => {
    const RefreshToken = require('../models/refreshToken');

    const refreshed = await agent
      .post('/api/auth/refresh')
      .set('X-CSRF-Token', csrfToken)
      .expect(200);
    assert.ok(refreshed.body.accessToken);
    assert.equal(await RefreshToken.countDocuments({ revokedAt: { $ne: null } }), 1);

    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrfToken).expect(200);
    assert.equal(await RefreshToken.countDocuments({ revokedAt: { $ne: null } }), 2);

    await agent.post('/api/auth/refresh').set('X-CSRF-Token', csrfToken).expect(401);
  }
);
