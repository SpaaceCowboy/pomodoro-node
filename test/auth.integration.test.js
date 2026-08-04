const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const request = require('supertest');

const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);
let app;
let agent;
let csrfToken;
let accessToken;
let secondAgent;
let secondCsrfToken;
let secondAccessToken;
let secondUserId;

before(async () => {
  if (!hasTestDatabase) return;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  process.env.JWT_SECRET = 'test-access-secret-with-sufficient-entropy';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret-with-sufficient-entropy';
  process.env.NODE_ENV = 'test';
  process.env.VERCEL = '1';
  process.env.CORS_ORIGINS = 'http://localhost:3002';

  app = require('../server');
  await app.ready;
  const { query } = require('../config/db');
  await query('TRUNCATE TABLE users, rate_limits CASCADE');
  agent = request.agent(app);
});

after(async () => {
  if (!hasTestDatabase) return;
  const { query } = require('../config/db');
  await query('TRUNCATE TABLE users, rate_limits CASCADE');
  await app.shutdown('test cleanup');
});

test('health endpoint is available', { skip: !hasTestDatabase }, async () => {
  const response = await request(app).get('/api/health').expect(200);
  assert.equal(response.body.status, 'ok');
  assert.match(response.headers['x-request-id'], /^[a-zA-Z0-9._-]{8,64}$/);
});

test('metrics endpoint exposes HTTP and runtime metrics', { skip: !hasTestDatabase }, async () => {
  const response = await request(app).get('/api/metrics').expect(200);
  assert.match(response.text, /pomodoro_http_requests_total/);
  assert.match(response.text, /pomodoro_process_cpu_seconds_total/);
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
  'PostgreSQL-backed settings, sessions, push subscriptions, and public stats work',
  {
    skip: !hasTestDatabase,
  },
  async () => {
    await agent.post('/api/timer/pause').set('Authorization', `Bearer ${accessToken}`).expect(200);
    await agent.post('/api/timer/reset').set('Authorization', `Bearer ${accessToken}`).expect(200);

    const settings = await agent
      .patch('/api/settings')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ focusSec: 60, dailyFocusGoalMin: 30, ambientSound: 'brown' })
      .expect(200);
    assert.equal(settings.body.focusSec, 60);
    assert.equal(settings.body.ambientSound, 'brown');

    const sessions = await agent
      .get('/api/timer/sessions')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    assert.equal(sessions.body.sessions.length, 1);
    assert.equal(sessions.body.sessions[0].label, 'Integration test');

    await agent
      .patch('/api/profile/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ nickname: 'Test Timer', publicProfileEnabled: true })
      .expect(200);

    const publicProfile = await request(app).get('/api/public/users/test_user').expect(200);
    assert.equal(publicProfile.body.profile.displayName, 'Test Timer');

    const subscription = {
      endpoint: 'https://push.example.test/subscription-1',
      keys: { p256dh: 'test-p256dh', auth: 'test-auth' },
    };
    await agent
      .post('/api/push/subscribe')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ subscription })
      .expect(201);
    await agent
      .delete('/api/push/subscribe')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ endpoint: subscription.endpoint })
      .expect(200);
  }
);

test('PostgreSQL-backed friendships and focus rooms work', { skip: !hasTestDatabase }, async () => {
  secondAgent = request.agent(app);
  const csrf = await secondAgent.get('/api/auth/csrf').expect(200);
  secondCsrfToken = csrf.body.csrfToken;
  const registration = await secondAgent
    .post('/api/auth/register')
    .set('X-CSRF-Token', secondCsrfToken)
    .send({
      name: 'Second Person',
      username: 'second_user',
      email: 'second@example.com',
      password: 'Correct-Horse-8',
    })
    .expect(201);
  secondAccessToken = registration.body.accessToken;
  secondUserId = registration.body.user.id;

  const search = await agent
    .get('/api/social/users/search?q=second')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  assert.equal(search.body.users[0].id, secondUserId);

  const requestResult = await agent
    .post('/api/social/friends/request')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ userId: secondUserId })
    .expect(201);

  await secondAgent
    .post(`/api/social/friends/${requestResult.body.friendship.id}/accept`)
    .set('Authorization', `Bearer ${secondAccessToken}`)
    .expect(200);

  const friends = await agent
    .get('/api/social/friends')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  assert.equal(friends.body.friends[0].friend.username, 'second_user');

  const createdRoom = await agent
    .post('/api/social/rooms')
    .set('Authorization', `Bearer ${accessToken}`)
    .send({ name: 'SQL room' })
    .expect(201);
  const code = createdRoom.body.room.code;

  const joinedRoom = await secondAgent
    .post(`/api/social/rooms/${code}/join`)
    .set('Authorization', `Bearer ${secondAccessToken}`)
    .expect(200);
  assert.equal(joinedRoom.body.room.members.length, 2);

  await secondAgent
    .post(`/api/social/rooms/${code}/leave`)
    .set('Authorization', `Bearer ${secondAccessToken}`)
    .expect(200);
});

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
    assert.equal(await RefreshToken.countRevoked(), 1);

    await agent.post('/api/auth/logout').set('X-CSRF-Token', csrfToken).expect(200);
    assert.equal(await RefreshToken.countRevoked(), 2);

    await agent.post('/api/auth/refresh').set('X-CSRF-Token', csrfToken).expect(401);
  }
);
