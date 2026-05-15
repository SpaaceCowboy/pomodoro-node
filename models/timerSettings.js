const mongoose = require('mongoose');
const { FOCUS_SEC, SHORT_BREAK_SEC, LONG_BREAK_SEC, LONG_BREAK_EVERY } = require('../config/timer');

const timerSettingsSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      unique: true,
      index: true,
      required: true,
    },

    // Durations in seconds.
    focusSec: { type: Number, default: FOCUS_SEC, min: 60, max: 4 * 60 * 60 },
    shortBreakSec: { type: Number, default: SHORT_BREAK_SEC, min: 30, max: 60 * 60 },
    longBreakSec: { type: Number, default: LONG_BREAK_SEC, min: 60, max: 2 * 60 * 60 },

    // Cadence: long break after every N consecutive focus completions.
    longBreakEvery: { type: Number, default: LONG_BREAK_EVERY, min: 2, max: 12 },

    // Behavior flags.
    autoStartNext: { type: Boolean, default: true },
    notificationsEnabled: { type: Boolean, default: true },
    soundEnabled: { type: Boolean, default: false },

    // Ambient noise played during focus segments.
    ambientSound: {
      type: String,
      enum: ['none', 'white', 'pink', 'brown'],
      default: 'none',
    },
    ambientVolume: { type: Number, default: 40, min: 0, max: 100 },

    // Daily focus goal (minutes) and streak display toggle.
    dailyFocusGoalMin: { type: Number, default: 120, min: 5, max: 24 * 60 },
    streakEnabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TimerSettings', timerSettingsSchema);
