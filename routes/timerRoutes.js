const express = require('express');
const router = express.Router();

const auth = require('../middleware/auth');

// importing controllers
const {
  getHealth,
  getState,
  postStart,
  getStats,
  postPause,
  postReset,
  postSwitch,
  getSessions,
  getLabelStats,
  patchLabel,
} = require('../controllers/timerController');

// Base path is /api (mounted in server.js)
router.get('/health', getHealth);

// Timer endpoints require authentication
router.get('/timer/state', auth, getState);
router.post('/timer/start', auth, postStart);
router.post('/timer/pause', auth, postPause);
router.post('/timer/reset', auth, postReset);
router.post('/timer/switch', auth, postSwitch);
router.get('/timer/stats', auth, getStats);
router.get('/timer/sessions', auth, getSessions);
router.get('/timer/stats/labels', auth, getLabelStats);
router.patch('/timer/label', auth, patchLabel);

module.exports = router;
