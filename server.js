// Import required modules
const express = require('express');
const cors = require('cors');
require('dotenv').config()

// Create our app
const app = express();
const PORT = process.env.PORT || 5000;

// Allow frontend to talk to backend
app.use(cors( {
  origin: [
    'http://localhost:3000',
    'https://pomodoro-next-chi.vercel.app/'
  ]
}));
app.use(express.json());

// Store timer state
let timerState = {
  isRunning: false,
  isFocus: true,
  timeLeft: 25 * 60,
  totalSessions: 0,
  consecutiveSessions: 0  // Track sessions for long breaks
};

let lastUpdateTime = Date.now();

// Update timer every second
setInterval(() => {
  if (timerState.isRunning) {
    const now = Date.now();
    const secondsPassed = Math.floor((now - lastUpdateTime) / 1000);
    
    if (secondsPassed > 0) {
      timerState.timeLeft -= secondsPassed;
      lastUpdateTime = now;
      
      // Timer reached zero
      if (timerState.timeLeft <= 0) {
        timerState.timeLeft = 0;
        timerState.isRunning = false;
        
        // Switch between focus and break
        if (timerState.isFocus) {
          // Focus time finished, start break
          timerState.isFocus = false;
          timerState.totalSessions += 1;
          timerState.consecutiveSessions += 1;
          
          // Check if it's time for a long break (every 4 sessions)
          if (timerState.consecutiveSessions >= 4) {
            timerState.timeLeft = 15 * 60; // 15 minute long break
            timerState.consecutiveSessions = 0;
            console.log('🎉 Completed 4 sessions! Taking 15-minute long break.');
          } else {
            timerState.timeLeft = 5 * 60; // 5 minute short break
            console.log('Focus session completed! Taking 5-minute break.');
          }
        } else {
          // Break finished, start focus
          timerState.isFocus = true;
          timerState.timeLeft = 25 * 60;
          console.log('Break finished! Back to focus time.');
        }
      }
    }
  }
}, 1000);

// Routes

// GET /api/timer/state - Get current timer state
app.get('/api/timer/state', (req, res) => {
  res.json(timerState);
});

// POST /api/timer/start - Start the timer
app.post('/api/timer/start', (req, res) => {
  timerState.isRunning = true;
  lastUpdateTime = Date.now();
  res.json({ success: true, state: timerState });
});

// POST /api/timer/pause - Pause the timer
app.post('/api/timer/pause', (req, res) => {
  timerState.isRunning = false;
  res.json({ success: true, state: timerState });
});

// POST /api/timer/reset - Reset the timer
app.post('/api/timer/reset', (req, res) => {
  timerState.isRunning = false;
  timerState.timeLeft = timerState.isFocus ? 25 * 60 : 5 * 60;
  res.json({ success: true, state: timerState });
});

// POST /api/timer/switch - Switch between focus and break
app.post('/api/timer/switch', (req, res) => {
  timerState.isFocus = !timerState.isFocus;
  
  // Set appropriate time based on mode
  if (timerState.isFocus) {
    timerState.timeLeft = 25 * 60;
  } else {
    // If switching to break, check if it should be long break
    if (timerState.consecutiveSessions >= 4) {
      timerState.timeLeft = 15 * 60;
      timerState.consecutiveSessions = 0;
    } else {
      timerState.timeLeft = 5 * 60;
    }
  }
  
  timerState.isRunning = false;
  res.json({ success: true, state: timerState });
});

// GET /api/timer/stats - Get session statistics
app.get('/api/timer/stats', (req, res) => {
  const stats = {
    totalSessions: timerState.totalSessions,
    consecutiveSessions: timerState.consecutiveSessions,
    nextLongBreak: Math.max(0, 4 - timerState.consecutiveSessions),
    isLongBreakNext: timerState.consecutiveSessions >= 3
  };
  res.json(stats);
});

module.exports = app
// Start the server
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  });
}