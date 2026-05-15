const express = require('express');
const auth = require('../middleware/auth');
const TimerSettings = require('../models/timerSettings');

const router = express.Router();

const UPDATABLE_FIELDS = [
  'focusSec',
  'shortBreakSec',
  'longBreakSec',
  'longBreakEvery',
  'autoStartNext',
  'notificationsEnabled',
  'soundEnabled',
  'ambientSound',
  'ambientVolume',
  'dailyFocusGoalMin',
  'streakEnabled',
];

async function getOrCreate(userId) {
  let doc = await TimerSettings.findOne({ user: userId });
  if (!doc) doc = await TimerSettings.create({ user: userId });
  return doc;
}

router.get('/', auth, async (req, res, next) => {
  try {
    const doc = await getOrCreate(req.user.id);
    res.json(doc);
  } catch (err) {
    next(err);
  }
});

router.patch('/', auth, async (req, res, next) => {
  try {
    const doc = await getOrCreate(req.user.id);

    for (const key of UPDATABLE_FIELDS) {
      if (req.body[key] !== undefined) {
        doc[key] = req.body[key];
      }
    }

    try {
      await doc.save();
    } catch (err) {
      if (err.name === 'ValidationError') {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }

    res.json(doc);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
