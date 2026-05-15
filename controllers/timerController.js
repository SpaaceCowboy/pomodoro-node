const mongoose = require('mongoose');
const TimerState = require('../models/timerState');
const TimerSettings = require('../models/timerSettings');
const Session = require('../models/session');
const { MAX_AUTO_FINALIZE_ITERATIONS, focusSessionsUntilLongBreak } = require('../config/timer');

// ---------- helpers ----------

async function getOrCreateTimerState(userId) {
  let doc = await TimerState.findOne({ user: userId });
  if (!doc) doc = await TimerState.create({ user: userId });
  return doc;
}

async function getOrCreateSettings(userId) {
  let doc = await TimerSettings.findOne({ user: userId });
  if (!doc) doc = await TimerSettings.create({ user: userId });
  return doc;
}

// Pure: returns the duration of the user's *current* segment given mode/flag/settings.
function currentSegmentDurationSec(doc, settings) {
  if (doc.mode === 'focus') return settings.focusSec;
  return doc.isLongBreak ? settings.longBreakSec : settings.shortBreakSec;
}

// Write a Session row for the segment that just ended.
function makeSessionRecord(doc, endedAt, completed) {
  return {
    user: doc.user,
    mode: doc.mode,
    isLongBreak: doc.mode === 'break' ? doc.isLongBreak : false,
    startedAt: doc.segmentStartedAt || endedAt,
    endedAt,
    durationSec: doc.remainingSec, // configured length of the segment
    pausedSec: doc.pausedSec,
    completed,
    label: doc.mode === 'focus' ? doc.currentLabel || '' : '',
  };
}

// Apply one completed segment to `doc` and write its Session.
function advanceToNextSegment(doc, settings, boundaryAt, pendingSessions) {
  // Snapshot the segment that just finished, but only if it was ever started.
  if (doc.segmentStartedAt) {
    pendingSessions.push(makeSessionRecord(doc, boundaryAt, /* completed */ true));
  }

  if (doc.mode === 'focus') {
    doc.totalSessions += 1;
    doc.consecutiveSessions += 1;
    doc.mode = 'break';

    if (doc.consecutiveSessions >= settings.longBreakEvery) {
      doc.isLongBreak = true;
      doc.consecutiveSessions = 0;
      doc.remainingSec = settings.longBreakSec;
    } else {
      doc.isLongBreak = false;
      doc.remainingSec = settings.shortBreakSec;
    }
  } else {
    doc.mode = 'focus';
    doc.isLongBreak = false;
    doc.remainingSec = settings.focusSec;
  }

  // Reset per-segment fields.
  doc.segmentStartedAt = boundaryAt;
  doc.pausedSec = 0;
  doc.pausedAt = null;
  doc.currentLabel = '';
}

// Core engine: applies elapsed wall-clock time to the doc, finalizing segments
// as they complete and (optionally) auto-starting the next one.
// Returns { state, changed, pendingSessions }.
function computeAndMaybeFinalize(doc, settings) {
  const nowMs = Date.now();
  const pendingSessions = [];
  let changed = false;

  let timeLeft = doc.remainingSec;

  if (doc.isRunning && doc.startedAt) {
    let remainingElapsed = Math.floor((nowMs - doc.startedAt.getTime()) / 1000);
    timeLeft = doc.remainingSec - remainingElapsed;

    let iterations = 0;
    while (timeLeft <= 0 && iterations < MAX_AUTO_FINALIZE_ITERATIONS) {
      changed = true;
      // Wall-clock instant when the just-running segment finished.
      const segBoundary = new Date(doc.startedAt.getTime() + doc.remainingSec * 1000);

      remainingElapsed -= doc.remainingSec;
      advanceToNextSegment(doc, settings, segBoundary, pendingSessions);

      // Anchor the new segment to the boundary instant.
      doc.startedAt = segBoundary;
      timeLeft = doc.remainingSec - remainingElapsed;
      iterations += 1;
    }

    if (timeLeft <= 0) {
      // Loop cap hit. Stop the timer cleanly at the start of the current segment.
      timeLeft = doc.remainingSec;
      doc.isRunning = false;
      doc.startedAt = null;
    } else if (changed && !settings.autoStartNext) {
      // Pause at the boundary so the user explicitly starts what comes next.
      doc.isRunning = false;
      doc.startedAt = null;
      timeLeft = doc.remainingSec;
    } else if (changed && settings.autoStartNext) {
      // Keep running, anchored at the most recent boundary, mid-new-segment.
      // doc.startedAt is already segBoundary; remainingSec is the new segment's full length.
      // We need to advance startedAt by the partial elapsed of the new segment
      // so that (now - startedAt) reflects the in-progress time.
      doc.startedAt = new Date(doc.startedAt.getTime() + remainingElapsed * 1000);
      // remainingElapsed === seconds already spent in current segment
    }
  }

  const state = {
    isRunning: doc.isRunning,
    isFocus: doc.mode === 'focus',
    timeLeft,
    totalSessions: doc.totalSessions,
    consecutiveSessions: doc.consecutiveSessions,
    currentLabel: doc.currentLabel || '',
    lastUpdated: nowMs,
  };

  return { state, changed, pendingSessions };
}

async function persistChanges(doc, pendingSessions) {
  if (pendingSessions.length) {
    await Session.insertMany(pendingSessions);
  }
  await doc.save();
}

// Day boundaries in the server's local TZ. Adequate for a single-user app.
function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfThisWeekMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d.getTime();
}

// Walk back day-by-day, counting consecutive days where focus minutes met the
// goal. Today is allowed to "not count yet" — if today is short of the goal we
// start the count from yesterday. As soon as a day falls short, stop.
// Looks back at most 365 days.
async function computeStreak(userId, dailyGoalMin) {
  if (!dailyGoalMin || dailyGoalMin <= 0) return 0;
  const goalSec = dailyGoalMin * 60;

  const lookbackStart = new Date();
  lookbackStart.setHours(0, 0, 0, 0);
  lookbackStart.setDate(lookbackStart.getDate() - 365);

  const rows = await Session.aggregate([
    {
      $match: {
        user: new mongoose.Types.ObjectId(userId),
        mode: 'focus',
        completed: true,
        endedAt: { $gte: lookbackStart },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$endedAt' },
        },
        sec: { $sum: '$durationSec' },
      },
    },
  ]);

  const byDay = new Map(rows.map((r) => [r._id, r.sec]));
  const fmt = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  // If today hasn't hit the goal yet, don't break the existing streak —
  // start counting from yesterday.
  if ((byDay.get(fmt(cursor)) || 0) < goalSec) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    if ((byDay.get(fmt(cursor)) || 0) >= goalSec) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ---------- route handlers ----------

exports.getHealth = (req, res) => {
  res.json({
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
  });
};

exports.getState = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [doc, settings] = await Promise.all([
      getOrCreateTimerState(userId),
      getOrCreateSettings(userId),
    ]);
    const { state, changed, pendingSessions } = computeAndMaybeFinalize(doc, settings);
    if (changed) await persistChanges(doc, pendingSessions);

    res.json(state);
  } catch (err) {
    next(err);
  }
};

exports.postStart = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [doc, settings] = await Promise.all([
      getOrCreateTimerState(userId),
      getOrCreateSettings(userId),
    ]);
    const { state, pendingSessions } = computeAndMaybeFinalize(doc, settings);

    const now = new Date();

    // If resuming from pause, fold the paused interval into pausedSec.
    if (doc.pausedAt) {
      doc.pausedSec += Math.max(0, (now.getTime() - doc.pausedAt.getTime()) / 1000);
      doc.pausedAt = null;
    }

    doc.isRunning = true;
    doc.startedAt = now;
    doc.remainingSec = state.timeLeft;

    // First time this segment ever starts? Mark the wall-clock origin and accept a label.
    if (!doc.segmentStartedAt) {
      doc.segmentStartedAt = now;
    }
    if (doc.mode === 'focus' && typeof req.body?.label === 'string') {
      doc.currentLabel = req.body.label.slice(0, 120);
    }

    await persistChanges(doc, pendingSessions);

    res.json({
      success: true,
      state: {
        ...state,
        isRunning: true,
        currentLabel: doc.currentLabel || '',
        lastUpdated: Date.now(),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.postPause = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [doc, settings] = await Promise.all([
      getOrCreateTimerState(userId),
      getOrCreateSettings(userId),
    ]);
    const { state, pendingSessions } = computeAndMaybeFinalize(doc, settings);

    doc.isRunning = false;
    doc.startedAt = null;
    doc.remainingSec = state.timeLeft;
    doc.pausedAt = new Date();

    await persistChanges(doc, pendingSessions);

    res.json({
      success: true,
      state: { ...state, isRunning: false, lastUpdated: Date.now() },
    });
  } catch (err) {
    next(err);
  }
};

async function cutShortAndReset(doc, settings, options) {
  // If a segment was in progress (even paused), record it as not-completed.
  const pendingSessions = [];
  const now = new Date();

  if (doc.segmentStartedAt) {
    // Fold any in-progress pause into pausedSec.
    let pausedSec = doc.pausedSec;
    if (doc.pausedAt) {
      pausedSec += Math.max(0, (now.getTime() - doc.pausedAt.getTime()) / 1000);
    }
    pendingSessions.push({
      user: doc.user,
      mode: doc.mode,
      isLongBreak: doc.mode === 'break' ? doc.isLongBreak : false,
      startedAt: doc.segmentStartedAt,
      endedAt: now,
      durationSec: currentSegmentDurationSec(doc, settings),
      pausedSec,
      completed: false,
      label: doc.mode === 'focus' ? doc.currentLabel || '' : '',
    });
  }

  // Apply the requested mode/reset.
  if (options.toggleMode) {
    doc.mode = doc.mode === 'focus' ? 'break' : 'focus';
    doc.isLongBreak = false; // manual switch never grants a long break
  }

  doc.isRunning = false;
  doc.startedAt = null;
  doc.segmentStartedAt = null;
  doc.pausedSec = 0;
  doc.pausedAt = null;
  doc.currentLabel = '';
  doc.remainingSec = currentSegmentDurationSec(doc, settings);

  return pendingSessions;
}

exports.postReset = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [doc, settings] = await Promise.all([
      getOrCreateTimerState(userId),
      getOrCreateSettings(userId),
    ]);

    const pendingSessions = await cutShortAndReset(doc, settings, { toggleMode: false });
    await persistChanges(doc, pendingSessions);

    res.json({
      success: true,
      state: {
        isRunning: false,
        isFocus: doc.mode === 'focus',
        timeLeft: doc.remainingSec,
        totalSessions: doc.totalSessions,
        consecutiveSessions: doc.consecutiveSessions,
        currentLabel: '',
        lastUpdated: Date.now(),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.postSwitch = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [doc, settings] = await Promise.all([
      getOrCreateTimerState(userId),
      getOrCreateSettings(userId),
    ]);
    // Apply any natural elapse first.
    const { pendingSessions: autoSessions } = computeAndMaybeFinalize(doc, settings);

    const cutSessions = await cutShortAndReset(doc, settings, { toggleMode: true });
    await persistChanges(doc, [...autoSessions, ...cutSessions]);

    res.json({
      success: true,
      state: {
        isRunning: false,
        isFocus: doc.mode === 'focus',
        timeLeft: doc.remainingSec,
        totalSessions: doc.totalSessions,
        consecutiveSessions: doc.consecutiveSessions,
        currentLabel: '',
        lastUpdated: Date.now(),
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.getStats = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const [doc, settings] = await Promise.all([
      getOrCreateTimerState(userId),
      getOrCreateSettings(userId),
    ]);
    const { changed, pendingSessions } = computeAndMaybeFinalize(doc, settings);
    if (changed) await persistChanges(doc, pendingSessions);

    const focusesUntil = focusSessionsUntilLongBreak(doc.consecutiveSessions);
    const isLongBreakNext = doc.mode === 'break' ? doc.isLongBreak : focusesUntil <= 1;

    const todayStart = new Date(startOfTodayMs());
    const weekStart = new Date(startOfThisWeekMs());

    const [todayFocus, weekFocus, todayFocusSec, streak] = await Promise.all([
      Session.countDocuments({
        user: userId,
        mode: 'focus',
        completed: true,
        endedAt: { $gte: todayStart },
      }),
      Session.countDocuments({
        user: userId,
        mode: 'focus',
        completed: true,
        endedAt: { $gte: weekStart },
      }),
      Session.aggregate([
        {
          $match: {
            user: new mongoose.Types.ObjectId(userId),
            mode: 'focus',
            completed: true,
            endedAt: { $gte: todayStart },
          },
        },
        { $group: { _id: null, sec: { $sum: '$durationSec' } } },
      ]).then((rows) => rows[0]?.sec || 0),
      computeStreak(userId, settings.dailyFocusGoalMin),
    ]);

    const todayFocusMin = Math.round(todayFocusSec / 60);

    res.json({
      totalSessions: doc.totalSessions,
      consecutiveSessions: doc.consecutiveSessions,
      nextLongBreak: focusesUntil,
      isLongBreakNext,
      todayFocus,
      weekFocus,
      todayFocusMin,
      dailyFocusGoalMin: settings.dailyFocusGoalMin,
      streak,
      streakEnabled: settings.streakEnabled,
    });
  } catch (err) {
    next(err);
  }
};

exports.getSessions = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { from, to, limit, mode, label } = req.query;
    const query = { user: userId };
    if (from || to) {
      query.endedAt = {};
      if (from) query.endedAt.$gte = new Date(from);
      if (to) query.endedAt.$lte = new Date(to);
    }
    if (mode === 'focus' || mode === 'break') query.mode = mode;
    if (typeof label === 'string' && label.length) query.label = label;

    const cap = Math.min(parseInt(limit, 10) || 100, 500);

    const sessions = await Session.find(query).sort({ endedAt: -1 }).limit(cap).lean();
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
};

exports.getLabelStats = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const { from, to } = req.query;
    const match = {
      user: new mongoose.Types.ObjectId(userId),
      mode: 'focus',
      completed: true,
    };
    if (from || to) {
      match.endedAt = {};
      if (from) match.endedAt.$gte = new Date(from);
      if (to) match.endedAt.$lte = new Date(to);
    }

    const rows = await Session.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $ifNull: ['$label', ''] },
          focusSec: { $sum: '$durationSec' },
          sessions: { $sum: 1 },
        },
      },
      { $project: { _id: 0, label: '$_id', focusSec: 1, sessions: 1 } },
      { $sort: { focusSec: -1 } },
    ]);

    res.json({ labels: rows });
  } catch (err) {
    next(err);
  }
};

exports.patchLabel = async (req, res, next) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const label = typeof req.body?.label === 'string' ? req.body.label.slice(0, 120) : '';

    const doc = await getOrCreateTimerState(userId);
    if (doc.mode === 'focus') {
      doc.currentLabel = label;
      await doc.save();
    }
    res.json({ success: true, currentLabel: doc.currentLabel || '' });
  } catch (err) {
    next(err);
  }
};
