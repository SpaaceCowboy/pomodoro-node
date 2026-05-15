const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },

    // 'focus' | 'break'
    mode: { type: String, enum: ['focus', 'break'], required: true },
    isLongBreak: { type: Boolean, default: false },

    // Wall-clock window: startedAt = when the segment first began, endedAt = when it terminated.
    startedAt: { type: Date, required: true },
    endedAt: { type: Date, required: true },

    // The segment's configured duration (what the user signed up for).
    durationSec: { type: Number, required: true },

    // How long the user was paused during this segment.
    pausedSec: { type: Number, default: 0 },

    // true = ran to natural completion; false = cut short by switch/reset.
    completed: { type: Boolean, default: true },

    // Optional user-supplied label (e.g. "migration", "code review").
    label: { type: String, default: '', maxlength: 120 },
  },
  { timestamps: true }
);

// For "today's sessions" / "this week" queries.
sessionSchema.index({ user: 1, endedAt: -1 });

module.exports = mongoose.model('Session', sessionSchema);
