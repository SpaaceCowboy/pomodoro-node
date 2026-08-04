const { randomUUID } = require('node:crypto');
const { query } = require('../config/db');

function mapUser(row) {
  if (!row) return null;
  return {
    _id: row.id,
    name: row.name,
    nickname: row.nickname,
    avatarDataUrl: row.avatar_data_url,
    publicProfileEnabled: row.public_profile_enabled,
    username: row.username,
    email: row.email,
    password: row.password,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create(values) {
  const result = await query(
    `INSERT INTO users (id, name, username, email, password)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [randomUUID(), values.name || '', values.username, values.email, values.password]
  );
  return mapUser(result.rows[0]);
}

async function findExisting(email, username) {
  const result = await query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1) OR LOWER(username) = LOWER($2) LIMIT 1',
    [email, username]
  );
  return mapUser(result.rows[0]);
}

async function findByEmail(email) {
  const result = await query('SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1', [email]);
  return mapUser(result.rows[0]);
}

async function findById(id) {
  const result = await query('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return mapUser(result.rows[0]);
}

async function updateById(id, updates) {
  const columns = {
    nickname: 'nickname',
    avatarDataUrl: 'avatar_data_url',
    publicProfileEnabled: 'public_profile_enabled',
  };
  const entries = Object.entries(updates).filter(([key]) => columns[key]);
  if (!entries.length) return findById(id);

  const values = entries.map(([, value]) => value);
  const assignments = entries.map(([key], index) => `${columns[key]} = $${index + 2}`);
  const result = await query(
    `UPDATE users SET ${assignments.join(', ')}, updated_at = NOW() WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return mapUser(result.rows[0]);
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

async function search(searchText, excludeId, limit = 12) {
  const pattern = `%${escapeLike(searchText)}%`;
  const result = await query(
    `SELECT * FROM users
     WHERE id <> $1
       AND (username ILIKE $2 ESCAPE '\\' OR nickname ILIKE $2 ESCAPE '\\'
         OR name ILIKE $2 ESCAPE '\\' OR email ILIKE $2 ESCAPE '\\')
     ORDER BY username ASC
     LIMIT $3`,
    [excludeId, pattern, limit]
  );
  return result.rows.map(mapUser);
}

async function findPublicByUsername(username) {
  const result = await query(
    `SELECT * FROM users
     WHERE LOWER(username) = LOWER($1) AND public_profile_enabled = TRUE
     LIMIT 1`,
    [username]
  );
  return mapUser(result.rows[0]);
}

module.exports = {
  create,
  findByEmail,
  findById,
  findExisting,
  findPublicByUsername,
  mapUser,
  search,
  updateById,
};
