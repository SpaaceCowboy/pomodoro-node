const { randomUUID } = require('node:crypto');
const { query } = require('../config/db');

function mapSession(row) {
  if (!row) return null;
  return {
    _id: row.id,
    user: row.user_id,
    mode: row.mode,
    isLongBreak: row.is_long_break,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationSec: row.duration_sec,
    pausedSec: row.paused_sec,
    completed: row.completed,
    label: row.label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function insertMany(records) {
  if (!records.length) return [];
  const values = [];
  const placeholders = records.map((record, rowIndex) => {
    const offset = rowIndex * 10;
    values.push(
      randomUUID(),
      record.user,
      record.mode,
      Boolean(record.isLongBreak),
      record.startedAt,
      record.endedAt,
      Math.round(record.durationSec),
      Number(record.pausedSec || 0),
      record.completed !== false,
      record.label || ''
    );
    return `(${Array.from({ length: 10 }, (_, index) => `$${offset + index + 1}`).join(', ')})`;
  });
  const result = await query(
    `INSERT INTO sessions
       (id, user_id, mode, is_long_break, started_at, ended_at, duration_sec, paused_sec, completed, label)
     VALUES ${placeholders.join(', ')}
     RETURNING *`,
    values
  );
  return result.rows.map(mapSession);
}

function addRangeFilters(conditions, values, { from, to }, column = 'ended_at') {
  if (from) {
    values.push(from);
    conditions.push(`${column} >= $${values.length}`);
  }
  if (to) {
    values.push(to);
    conditions.push(`${column} <= $${values.length}`);
  }
}

async function countFocus(userId, since) {
  const result = await query(
    `SELECT COUNT(*)::int AS count FROM sessions
     WHERE user_id = $1 AND mode = 'focus' AND completed = TRUE AND ended_at >= $2`,
    [userId, since]
  );
  return result.rows[0].count;
}

async function sumFocus(userId, since = null) {
  const values = [userId];
  const sinceClause = since ? `AND ended_at >= $${values.push(since)}` : '';
  const result = await query(
    `SELECT COALESCE(SUM(duration_sec), 0)::bigint AS focus_sec,
            COUNT(*)::int AS sessions
     FROM sessions
     WHERE user_id = $1 AND mode = 'focus' AND completed = TRUE ${sinceClause}`,
    values
  );
  return {
    focusSec: Number(result.rows[0].focus_sec),
    sessions: result.rows[0].sessions,
  };
}

async function dailyFocusTotals(userId, since) {
  const result = await query(
    `SELECT TO_CHAR(ended_at, 'YYYY-MM-DD') AS day,
            COALESCE(SUM(duration_sec), 0)::bigint AS sec
     FROM sessions
     WHERE user_id = $1 AND mode = 'focus' AND completed = TRUE AND ended_at >= $2
     GROUP BY day`,
    [userId, since]
  );
  return result.rows.map((row) => ({ day: row.day, sec: Number(row.sec) }));
}

async function list({ userId, from, to, mode, label, limit = 100 }) {
  const values = [userId];
  const conditions = ['user_id = $1'];
  addRangeFilters(conditions, values, { from, to });
  if (mode === 'focus' || mode === 'break') {
    values.push(mode);
    conditions.push(`mode = $${values.length}`);
  }
  if (typeof label === 'string' && label.length) {
    values.push(label);
    conditions.push(`label = $${values.length}`);
  }
  values.push(limit);
  const result = await query(
    `SELECT * FROM sessions WHERE ${conditions.join(' AND ')}
     ORDER BY ended_at DESC LIMIT $${values.length}`,
    values
  );
  return result.rows.map(mapSession);
}

async function labelStats({ userId, from, to, limit = null }) {
  const values = [userId];
  const conditions = ['user_id = $1', "mode = 'focus'", 'completed = TRUE'];
  addRangeFilters(conditions, values, { from, to });
  let limitClause = '';
  if (limit) {
    values.push(limit);
    limitClause = `LIMIT $${values.length}`;
  }
  const result = await query(
    `SELECT COALESCE(label, '') AS label,
            COALESCE(SUM(duration_sec), 0)::bigint AS focus_sec,
            COUNT(*)::int AS sessions
     FROM sessions
     WHERE ${conditions.join(' AND ')}
     GROUP BY COALESCE(label, '')
     ORDER BY focus_sec DESC
     ${limitClause}`,
    values
  );
  return result.rows.map((row) => ({
    label: row.label,
    focusSec: Number(row.focus_sec),
    sessions: row.sessions,
  }));
}

async function findDedupeWindow(userId, earliest, latest) {
  const result = await query(
    `SELECT * FROM sessions
     WHERE user_id = $1 AND started_at >= $2 AND ended_at <= $3`,
    [userId, earliest, latest]
  );
  return result.rows.map(mapSession);
}

module.exports = {
  countFocus,
  dailyFocusTotals,
  findDedupeWindow,
  insertMany,
  labelStats,
  list,
  mapSession,
  sumFocus,
};
