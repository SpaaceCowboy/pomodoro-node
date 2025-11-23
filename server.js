const express = require('express');
const cors = require('cors');

const app = express();

// Simple CORS - Allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// In-memory storage (will reset on serverless cold starts, but that's okay)
let timerState = {
  isRunning: false,
  isFocus: true,
  timeLeft: 25 * 60,
  totalSessions: 0,
  consecutiveSessions: 0,
  lastUpdated: Date.now()
};

// Calculate the current state based on elapsed time
const calculateCurrentState = (state) => {
  const currentState = { ...state };
  
  if (currentState.isRunning) {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - currentState.lastUpdated) / 1000);
    
    if (elapsedSeconds > 0) {
      currentState.timeLeft = Math.max(0, currentState.timeLeft - elapsedSeconds);
      currentState.lastUpdated = now;
      
      // Check if timer completed
      if (currentState.timeLeft <= 0) {
        currentState.isRunning = false;
        
        // Auto-switch modes
        if (currentState.isFocus) {
          // Focus session completed
          currentState.isFocus = false;
          currentState.totalSessions += 1;
          currentState.consecutiveSessions += 1;
          
          // Check for long break
          if (currentState.consecutiveSessions >= 4) {
            currentState.timeLeft = 15 * 60; // 15 min long break
            currentState.consecutiveSessions = 0;
          } else {
            currentState.timeLeft = 5 * 60; // 5 min short break
          }
        } else {
          // Break completed
          currentState.isFocus = true;
          currentState.timeLeft = 25 * 60; // 25 min focus
        }
      }
    }
  }
  
  return currentState;
};

// Routes
app.get('/api/timer/state', (req, res) => {
  const currentState = calculateCurrentState(timerState);
  timerState = currentState; // Update stored state
  res.json(currentState);
});

app.post('/api/timer/start', (req, res) => {
  const currentState = calculateCurrentState(timerState);
  currentState.isRunning = true;
  currentState.lastUpdated = Date.now();
  timerState = currentState;
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/pause', (req, res) => {
  const currentState = calculateCurrentState(timerState);
  currentState.isRunning = false;
  currentState.lastUpdated = Date.now();
  timerState = currentState;
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/reset', (req, res) => {
  const currentState = calculateCurrentState(timerState);
  currentState.isRunning = false;
  currentState.timeLeft = currentState.isFocus ? 25 * 60 : 5 * 60;
  currentState.lastUpdated = Date.now();
  timerState = currentState;
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/switch', (req, res) => {
  const currentState = calculateCurrentState(timerState);
  currentState.isFocus = !currentState.isFocus;
  currentState.timeLeft = currentState.isFocus ? 25 * 60 : 5 * 60;
  currentState.isRunning = false;
  currentState.lastUpdated = Date.now();
  
  if (currentState.isFocus) {
    currentState.totalSessions += 1;
  }
  
  timerState = currentState;
  res.json({ success: true, state: currentState });
});

app.get('/api/timer/stats', (req, res) => {
  const currentState = calculateCurrentState(timerState);
  const stats = {
    totalSessions: currentState.totalSessions,
    consecutiveSessions: currentState.consecutiveSessions,
    nextLongBreak: Math.max(0, 4 - currentState.consecutiveSessions),
    isLongBreakNext: currentState.consecutiveSessions >= 3
  };
  res.json(stats);
});

// Health check with current state
app.get('/api/health', (req, res) => {
  const currentState = calculateCurrentState(timerState);
  res.json({ 
    status: 'Server is running!',
    timestamp: new Date().toISOString(),
    state: currentState
  });
});

// Export for Vercel
module.exports = app;