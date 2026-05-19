const express = require('express');
const mongoose = require('mongoose');
const Session = require('../models/session');
const TimerSettings = require('../models/timerSettings');
const User = require('../models/user');

const router = express.Router();

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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

  const byDay = new Map(rows.map((row) => [row._id, row.sec]));
  const cursor = startOfToday();

  if ((byDay.get(formatDay(cursor)) || 0) < goalSec) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  for (let i = 0; i < 365; i += 1) {
    if ((byDay.get(formatDay(cursor)) || 0) >= goalSec) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

router.get('/users/:handle', async (req, res, next) => {
  try {
    const handle = String(req.params.handle || '').trim();
    if (!handle) return res.status(404).json({ message: 'Profile not found' });

    const user = await User.findOne({
      username: new RegExp(`^${escapeRegex(handle)}$`, 'i'),
      publicProfileEnabled: true,
    })
      .select('name nickname avatarDataUrl username publicProfileEnabled createdAt')
      .lean();

    if (!user) return res.status(404).json({ message: 'Profile not found' });

    const userObjectId = new mongoose.Types.ObjectId(user._id);
    const weekStart = startOfThisWeek();

    const [settings, weekRows, topLabels, allTimeRows] = await Promise.all([
      TimerSettings.findOne({ user: user._id }).lean(),
      Session.aggregate([
        {
          $match: {
            user: userObjectId,
            mode: 'focus',
            completed: true,
            endedAt: { $gte: weekStart },
          },
        },
        {
          $group: {
            _id: null,
            focusSec: { $sum: '$durationSec' },
            sessions: { $sum: 1 },
          },
        },
      ]),
      Session.aggregate([
        {
          $match: {
            user: userObjectId,
            mode: 'focus',
            completed: true,
            endedAt: { $gte: weekStart },
          },
        },
        {
          $group: {
            _id: { $ifNull: ['$label', ''] },
            focusSec: { $sum: '$durationSec' },
            sessions: { $sum: 1 },
          },
        },
        { $project: { _id: 0, label: '$_id', focusSec: 1, sessions: 1 } },
        { $sort: { focusSec: -1 } },
        { $limit: 5 },
      ]),
      Session.aggregate([
        {
          $match: {
            user: userObjectId,
            mode: 'focus',
            completed: true,
          },
        },
        {
          $group: {
            _id: null,
            focusSec: { $sum: '$durationSec' },
            sessions: { $sum: 1 },
          },
        },
      ]),
    ]);

    const weekly = weekRows[0] || { focusSec: 0, sessions: 0 };
    const allTime = allTimeRows[0] || { focusSec: 0, sessions: 0 };
    const dailyGoalMin = settings?.dailyFocusGoalMin || 0;
    const streak =
      settings?.streakEnabled === false ? 0 : await computeStreak(user._id, dailyGoalMin);

    res.json({
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
    next(err);
  }
});

module.exports = router;
