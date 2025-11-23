const express = require('express');
const cors = require('cors');

const app = express();

// Enable CORS for all routes
app.use(cors());
app.use(express.json());

// Simple in-memory storage
let timerState = {
  isRunning: false,
  isFocus: true,
  timeLeft: 25 * 60,
  totalSessions: 0,
  consecutiveSessions: 0
};

// Health check - test if this works first
app.get('/api/health', (req, res) => {
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    state: timerState
  });
});

// Get timer state
app.get('/api/timer/state', (req, res) => {
  res.json(timerState);
});

// Start timer
app.post('/api/timer/start', (req, res) => {
  timerState.isRunning = true;
  res.json({ success: true, state: timerState });
});

// Pause timer
app.post('/api/timer/pause', (req, res) => {
  timerState.isRunning = false;
  res.json({ success: true, state: timerState });
});

// Reset timer
app.post('/api/timer/reset', (req, res) => {
  timerState.isRunning = false;
  timerState.timeLeft = timerState.isFocus ? 25 * 60 : 5 * 60;
  res.json({ success: true, state: timerState });
});

// Switch mode
app.post('/api/timer/switch', (req, res) => {
  timerState.isFocus = !timerState.isFocus;
  timerState.timeLeft = timerState.isFocus ? 25 * 60 : 5 * 60;
  timerState.isRunning = false;
  
  if (timerState.isFocus) {
    timerState.totalSessions += 1;
  }
  
  res.json({ success: true, state: timerState });
});

// Get stats
app.get('/api/timer/stats', (req, res) => {
  const stats = {
    totalSessions: timerState.totalSessions,
    consecutiveSessions: timerState.consecutiveSessions,
    nextLongBreak: Math.max(0, 4 - timerState.consecutiveSessions),
    isLongBreakNext: timerState.consecutiveSessions >= 3
  };
  res.json(stats);
});

// Handle all other routes
app.get('*', (req, res) => {
  res.json({ 
    message: 'Pomodoro API',
    endpoints: [
      'GET  /api/health',
      'GET  /api/timer/state',
      'POST /api/timer/start',
      'POST /api/timer/pause',
      'POST /api/timer/reset',
      'POST /api/timer/switch',
      'GET  /api/timer/stats'
    ]
  });
});

// Export for Vercel
module.exports = app;