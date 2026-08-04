const express = require('express');
const Session = require('../models/session');
const TimerSettings = require('../models/timerSettings');
const User = require('../models/user');

const router = express.Router();

function displayNameFor(user) {
  return user.nickname || user.name || user.username;
}

function startOfThisWeek() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDay(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function computeStreak(userId, dailyGoalMin) {
  if (!dailyGoalMin || dailyGoalMin <= 0) return 0;
  const goalSec = dailyGoalMin * 60;
  const lookbackStart = new Date();
  lookbackStart.setHours(0, 0, 0, 0);
  lookbackStart.setDate(lookbackStart.getDate() - 365);

  const rows = await Session.dailyFocusTotals(userId, lookbackStart);
  const byDay = new Map(rows.map((row) => [row.day, row.sec]));
  const cursor = startOfToday();
  if ((byDay.get(formatDay(cursor)) || 0) < goalSec) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    if ((byDay.get(formatDay(cursor)) || 0) < goalSec) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

router.get('/users/:handle', async (req, res, next) => {
  try {
    const handle = String(req.params.handle || '').trim();
    if (!handle) return res.status(404).json({ message: 'Profile not found' });

    const user = await User.findPublicByUsername(handle);
    if (!user) return res.status(404).json({ message: 'Profile not found' });

    const weekStart = startOfThisWeek();
    const [settings, weekly, topLabels, allTime] = await Promise.all([
      TimerSettings.findByUser(user._id),
      Session.sumFocus(user._id, weekStart),
      Session.labelStats({ userId: user._id, from: weekStart, limit: 5 }),
      Session.sumFocus(user._id),
    ]);

    const dailyGoalMin = settings?.dailyFocusGoalMin || 0;
    const streak =
      settings?.streakEnabled === false ? 0 : await computeStreak(user._id, dailyGoalMin);

    return res.json({
      profile: {
        username: user.username,
        displayName: displayNameFor(user),
        avatarDataUrl: user.avatarDataUrl || '',
        joinedAt: user.createdAt,
      },
      stats: {
        weekStart,
        weeklyFocusSec: weekly.focusSec,
        weeklySessions: weekly.sessions,
        allTimeFocusSec: allTime.focusSec,
        allTimeSessions: allTime.sessions,
        streak,
        dailyGoalMin,
      },
      topLabels,
    });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
