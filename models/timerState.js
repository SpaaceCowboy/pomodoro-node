const mongoose = require('mongoose');
const { FOCUS_SEC } = require('../config/timer');

const timerStateSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true },

    // 'focus' | 'break'
    mode: { type: String, enum: ['focus', 'break'], default: 'focus' },

    isRunning: { type: Boolean, default: false },

    // When paused, remainingSec is the exact remaining time.
    // When running, remainingSec is the remaining time at the moment the timer was started.
    remainingSec: { type: Number, default: FOCUS_SEC },

    // Only set while running.
    startedAt: { type: Date, default: null },

    totalSessions: { type: Number, default: 0 },

    // Number of focus sessions completed since last long break.
    // Reaches 4 right before the long break finalizes, then resets to 0.
    consecutiveSessions: { type: Number, default: 0 },

    // True only while the current break segment is the long break.
    // Reset to false when entering focus mode.
    isLongBreak: { type: Boolean, default: false },

    // Wall-clock time when the current segment first began. Distinct from
    // `startedAt`, which is reset on every pause/resume. Used to write the
    // Session row when the segment ends.
    segmentStartedAt: { type: Date, default: null },

    // Cumulative paused seconds for the current segment. Reset on segment change.
    pausedSec: { type: Number, default: 0 },

    // When the user paused; null while running or never-started.
    pausedAt: { type: Date, default: null },

    // Optional label attached to the current focus segment.
    currentLabel: { type: String, default: '', maxlength: 120 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('TimerState', timerStateSchema);
