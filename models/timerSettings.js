const { query } = require('../config/db');

const integerRules = {
  focusSec: [60, 4 * 60 * 60],
  shortBreakSec: [30, 60 * 60],
  longBreakSec: [60, 2 * 60 * 60],
  longBreakEvery: [2, 12],
  ambientVolume: [0, 100],
  dailyFocusGoalMin: [5, 24 * 60],
};
const booleanFields = ['autoStartNext', 'notificationsEnabled', 'soundEnabled', 'streakEnabled'];

function validationError(message) {
  const err = new Error(message);
  err.name = 'ValidationError';
  return err;
}

function normalizeAndValidate(record) {
  for (const [field, [min, max]] of Object.entries(integerRules)) {
    const value = Number(record[field]);
    if (!Number.isInteger(value) || value < min || value > max) {
      throw validationError(`${field} must be an integer between ${min} and ${max}`);
    }
    record[field] = value;
  }
  for (const field of booleanFields) {
    if (typeof record[field] !== 'boolean') throw validationError(`${field} must be a boolean`);
  }
  if (!['none', 'white', 'pink', 'brown'].includes(record.ambientSound)) {
    throw validationError('ambientSound is invalid');
  }
}

function mapTimerSettings(row) {
  if (!row) return null;
  const record = {
    _id: row.user_id,
    user: row.user_id,
    focusSec: row.focus_sec,
    shortBreakSec: row.short_break_sec,
    longBreakSec: row.long_break_sec,
    longBreakEvery: row.long_break_every,
    autoStartNext: row.auto_start_next,
    notificationsEnabled: row.notifications_enabled,
    soundEnabled: row.sound_enabled,
    ambientSound: row.ambient_sound,
    ambientVolume: row.ambient_volume,
    dailyFocusGoalMin: row.daily_focus_goal_min,
    streakEnabled: row.streak_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  Object.defineProperty(record, 'save', { value: () => save(record), enumerable: false });
  return record;
}

async function getOrCreate(userId) {
  await query('INSERT INTO timer_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING', [
    userId,
  ]);
  return findByUser(userId);
}

async function findByUser(userId) {
  const result = await query('SELECT * FROM timer_settings WHERE user_id = $1', [userId]);
  return mapTimerSettings(result.rows[0]);
}

async function save(record) {
  normalizeAndValidate(record);
  const result = await query(
    `UPDATE timer_settings SET
       focus_sec = $2, short_break_sec = $3, long_break_sec = $4,
       long_break_every = $5, auto_start_next = $6, notifications_enabled = $7,
       sound_enabled = $8, ambient_sound = $9, ambient_volume = $10,
       daily_focus_goal_min = $11, streak_enabled = $12, updated_at = NOW()
     WHERE user_id = $1
     RETURNING *`,
    [
      record.user,
      record.focusSec,
      record.shortBreakSec,
      record.longBreakSec,
      record.longBreakEvery,
      record.autoStartNext,
      record.notificationsEnabled,
      record.soundEnabled,
      record.ambientSound,
      record.ambientVolume,
      record.dailyFocusGoalMin,
      record.streakEnabled,
    ]
  );
  Object.assign(record, mapTimerSettings(result.rows[0]));
  return record;
}

module.exports = { findByUser, getOrCreate, mapTimerSettings, save };
