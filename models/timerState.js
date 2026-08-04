const { query } = require('../config/db');

function mapTimerState(row) {
  if (!row) return null;
  const record = {
    _id: row.user_id,
    user: row.user_id,
    mode: row.mode,
    isRunning: row.is_running,
    remainingSec: row.remaining_sec,
    startedAt: row.started_at,
    totalSessions: row.total_sessions,
    consecutiveSessions: row.consecutive_sessions,
    isLongBreak: row.is_long_break,
    segmentStartedAt: row.segment_started_at,
    pausedSec: row.paused_sec,
    pausedAt: row.paused_at,
    currentLabel: row.current_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  Object.defineProperty(record, 'save', { value: () => save(record), enumerable: false });
  return record;
}

async function getOrCreate(userId) {
  await query('INSERT INTO timer_states (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [
    userId,
  ]);
  const result = await query('SELECT * FROM timer_states WHERE user_id = $1', [userId]);
  return mapTimerState(result.rows[0]);
}

async function save(record) {
  const result = await query(
    `UPDATE timer_states SET
       mode = $2, is_running = $3, remaining_sec = $4, started_at = $5,
       total_sessions = $6, consecutive_sessions = $7, is_long_break = $8,
       segment_started_at = $9, paused_sec = $10, paused_at = $11,
       current_label = $12, updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [
      record.user,
      record.mode,
      record.isRunning,
      Math.round(record.remainingSec),
      record.startedAt,
      record.totalSessions,
      record.consecutiveSessions,
      record.isLongBreak,
      record.segmentStartedAt,
      record.pausedSec,
      record.pausedAt,
      record.currentLabel || '',
    ]
  );
  const updated = mapTimerState(result.rows[0]);
  Object.assign(record, updated);
  return record;
}

async function findByUserIds(userIds) {
  if (!userIds.length) return [];
  const result = await query('SELECT * FROM timer_states WHERE user_id = ANY($1::uuid[])', [
    userIds,
  ]);
  return result.rows.map(mapTimerState);
}

module.exports = { findByUserIds, getOrCreate, mapTimerState, save };
