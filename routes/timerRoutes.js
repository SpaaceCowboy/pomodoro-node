const express = require('express')
const router = express.Router()


// importing controllers
const {
  getHealth,
  getState,
  postStart,
  getStats,
  postPause,
  postReset,
  postSwitch
} = require('../controllers/timerController');

// Base path is /api (mounted in server.js)
router.get('/health', getHealth);
router.get('/timer/state', getState);
router.post('/timer/start', postStart);
router.post('/timer/pause', postPause);
router.post('/timer/reset', postReset);
router.post('/timer/switch', postSwitch);
router.get('/timer/stats', getStats);


module.exports = router