const { randomUUID } = require('node:crypto');
const { query } = require('../config/db');
const { mapUser } = require('./user');

function mapRefreshToken(row, user = null) {
  if (!row) return null;
  const record = {
    _id: row.id,
    user: user || row.user_id,
    tokenHash: row.token_hash,
    jti: row.jti,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    replacedBy: row.replaced_by,
    createdAt: row.created_at,
    ip: row.ip,
    userAgent: row.user_agent,
  };
  Object.defineProperty(record, 'save', { value: () => save(record), enumerable: false });
  return record;
}

async function create(values) {
  const result = await query(
    `INSERT INTO refresh_tokens
       (id, user_id, token_hash, jti, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      randomUUID(),
      values.user,
      values.tokenHash,
      values.jti,
      values.expiresAt,
      values.ip || null,
      values.userAgent || '',
    ]
  );
  return mapRefreshToken(result.rows[0]);
}

async function findByHash(tokenHash) {
  const result = await query('SELECT * FROM refresh_tokens WHERE token_hash = $1 LIMIT 1', [
    tokenHash,
  ]);
  return mapRefreshToken(result.rows[0]);
}

async function findByHashAndJtiWithUser(tokenHash, jti) {
  const result = await query(
    `SELECT rt.*, ROW_TO_JSON(u) AS joined_user
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.jti = $2
     LIMIT 1`,
    [tokenHash, jti]
  );
  const row = result.rows[0];
  return row ? mapRefreshToken(row, mapUser(row.joined_user)) : null;
}

async function save(record) {
  const userId = typeof record.user === 'object' ? record.user._id : record.user;
  const result = await query(
    `UPDATE refresh_tokens
     SET revoked_at = $2, replaced_by = $3
     WHERE id = $1
     RETURNING *`,
    [record._id, record.revokedAt, record.replacedBy]
  );
  const updated = mapRefreshToken(
    result.rows[0],
    typeof record.user === 'object' ? record.user : null
  );
  Object.assign(record, updated, { user: record.user || userId });
  return record;
}

async function countRevoked() {
  const result = await query(
    'SELECT COUNT(*)::int AS count FROM refresh_tokens WHERE revoked_at IS NOT NULL'
  );
  return result.rows[0].count;
}

module.exports = { countRevoked, create, findByHash, findByHashAndJtiWithUser, save };
