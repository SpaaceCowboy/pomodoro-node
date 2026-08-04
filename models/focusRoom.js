const { randomUUID } = require('node:crypto');
const { query, withTransaction } = require('../config/db');
const { mapUser } = require('./user');

async function loadMembers(roomId, executor = { query }) {
  const result = await executor.query(
    `SELECT u.*, m.joined_at
     FROM focus_room_members m
     JOIN users u ON u.id = m.user_id
     WHERE m.room_id = $1
     ORDER BY m.joined_at ASC`,
    [roomId]
  );
  return result.rows.map((row) => ({ user: mapUser(row), joinedAt: row.joined_at }));
}

async function mapRoom(row, executor = { query }) {
  if (!row) return null;
  return {
    _id: row.id,
    code: row.code,
    name: row.name,
    host: row.host_id,
    active: row.active,
    members: await loadMembers(row.id, executor),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function create({ code, name, host }) {
  return withTransaction(async (client) => {
    const id = randomUUID();
    const result = await client.query(
      `INSERT INTO focus_rooms (id, code, name, host_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, code, name || '', host]
    );
    await client.query('INSERT INTO focus_room_members (room_id, user_id) VALUES ($1, $2)', [
      id,
      host,
    ]);
    return mapRoom(result.rows[0], client);
  });
}

async function findActiveByCode(code) {
  const result = await query(
    'SELECT * FROM focus_rooms WHERE code = $1 AND active = TRUE LIMIT 1',
    [code]
  );
  return mapRoom(result.rows[0]);
}

async function join(roomId, userId) {
  await query(
    `INSERT INTO focus_room_members (room_id, user_id)
     VALUES ($1, $2)
     ON CONFLICT (room_id, user_id) DO NOTHING`,
    [roomId, userId]
  );
  const result = await query('SELECT * FROM focus_rooms WHERE id = $1', [roomId]);
  return mapRoom(result.rows[0]);
}

async function leave(roomId, userId) {
  return withTransaction(async (client) => {
    await client.query('DELETE FROM focus_room_members WHERE room_id = $1 AND user_id = $2', [
      roomId,
      userId,
    ]);
    const countResult = await client.query(
      'SELECT COUNT(*)::int AS count FROM focus_room_members WHERE room_id = $1',
      [roomId]
    );
    if (countResult.rows[0].count === 0) {
      await client.query(
        'UPDATE focus_rooms SET active = FALSE, updated_at = NOW() WHERE id = $1',
        [roomId]
      );
    }
  });
}

module.exports = { create, findActiveByCode, join, leave };
