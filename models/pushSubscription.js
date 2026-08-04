const { randomUUID } = require('node:crypto');
const { query } = require('../config/db');

function mapSubscription(row) {
  if (!row) return null;
  return {
    _id: row.id,
    user: row.user_id,
    endpoint: row.endpoint,
    keys: { p256dh: row.p256dh, auth: row.auth },
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function upsert({ user, endpoint, keys, userAgent }) {
  const result = await query(
    `INSERT INTO push_subscriptions
       (id, user_id, endpoint, p256dh, auth, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (endpoint) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       p256dh = EXCLUDED.p256dh,
       auth = EXCLUDED.auth,
       user_agent = EXCLUDED.user_agent,
       updated_at = NOW()
     RETURNING *`,
    [randomUUID(), user, endpoint, keys.p256dh, keys.auth, userAgent || '']
  );
  return mapSubscription(result.rows[0]);
}

async function listByUser(userId) {
  const result = await query('SELECT * FROM push_subscriptions WHERE user_id = $1', [userId]);
  return result.rows.map(mapSubscription);
}

async function remove({ userId = null, endpoint }) {
  const values = [endpoint];
  const userClause = userId ? `AND user_id = $${values.push(userId)}` : '';
  await query(`DELETE FROM push_subscriptions WHERE endpoint = $1 ${userClause}`, values);
}

module.exports = { listByUser, remove, upsert };
