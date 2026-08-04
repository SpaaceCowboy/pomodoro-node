const { randomUUID } = require('node:crypto');
const { query } = require('../config/db');
const { mapUser } = require('./user');

function mapFriendship(row) {
  if (!row) return null;
  return {
    _id: row.id,
    requester: row.requester_user ? mapUser(row.requester_user) : row.requester_id,
    recipient: row.recipient_user ? mapUser(row.recipient_user) : row.recipient_id,
    pairKey: row.pair_key,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listForUser(userId, status) {
  const result = await query(
    `SELECT f.*, ROW_TO_JSON(requester) AS requester_user,
            ROW_TO_JSON(recipient) AS recipient_user
     FROM friendships f
     JOIN users requester ON requester.id = f.requester_id
     JOIN users recipient ON recipient.id = f.recipient_id
     WHERE f.status = $2 AND (f.requester_id = $1 OR f.recipient_id = $1)
     ORDER BY f.updated_at DESC`,
    [userId, status]
  );
  return result.rows.map(mapFriendship);
}

async function findByPairKey(pairKey) {
  const result = await query('SELECT * FROM friendships WHERE pair_key = $1 LIMIT 1', [pairKey]);
  return mapFriendship(result.rows[0]);
}

async function create({ requester, recipient, pairKey, status = 'pending' }) {
  const result = await query(
    `INSERT INTO friendships (id, requester_id, recipient_id, pair_key, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [randomUUID(), requester, recipient, pairKey, status]
  );
  return mapFriendship(result.rows[0]);
}

async function accept(id, recipientId) {
  const result = await query(
    `UPDATE friendships SET status = 'accepted', updated_at = NOW()
     WHERE id = $1 AND recipient_id = $2 AND status = 'pending'
     RETURNING *`,
    [id, recipientId]
  );
  return mapFriendship(result.rows[0]);
}

async function remove(id, userId) {
  const result = await query(
    `DELETE FROM friendships
     WHERE id = $1 AND (requester_id = $2 OR recipient_id = $2)
     RETURNING *`,
    [id, userId]
  );
  return mapFriendship(result.rows[0]);
}

module.exports = { accept, create, findByPairKey, listForUser, remove };
