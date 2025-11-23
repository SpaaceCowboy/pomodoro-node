const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Simple CORS - Allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());

// Store timer state per session (works with serverless)
let timerState = {
  isRunning: false,
  isFocus: true,
  timeLeft: 25 * 60,
  totalSessions: 0,
  consecutiveSessions: 0,
  lastUpdated: Date.now()
};

// Calculate elapsed time when requested
const getCurrentTimerState = () => {
  const state = { ...timerState };
  
  if (state.isRunning) {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - state.lastUpdated) / 1000);
    
    if (elapsedSeconds > 0) {
      state.timeLeft = Math.max(0, state.timeLeft - elapsedSeconds);
      state.lastUpdated = now;
      
      // Handle timer completion
      if (state.timeLeft === 0) {
        state.isRunning = false;
        
        if (state.isFocus) {
          // Focus completed, switch to break
          state.isFocus = false;
          state.totalSessions += 1;
          state.consecutiveSessions += 1;
          
          if (state.consecutiveSessions >= 4) {
            state.timeLeft = 15 * 60; // Long break
            state.consecutiveSessions = 0;
          } else {
            state.timeLeft = 5 * 60; // Short break
          }
        } else {
          // Break completed, switch to focus
          state.isFocus = true;
          state.timeLeft = 25 * 60;
        }
      }
    }
  }
  
  return state;
};

// Update the stored state with current calculations
const updateStoredState = (newState) => {
  timerState = { ...newState };
};

// Routes
app.get('/api/timer/state', (req, res) => {
  const currentState = getCurrentTimerState();
  updateStoredState(currentState);
  res.json(currentState);
});

app.post('/api/timer/start', (req, res) => {
  const currentState = getCurrentTimerState();
  currentState.isRunning = true;
  currentState.lastUpdated = Date.now();
  updateStoredState(currentState);
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/pause', (req, res) => {
  const currentState = getCurrentTimerState();
  currentState.isRunning = false;
  currentState.lastUpdated = Date.now();
  updateStoredState(currentState);
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/reset', (req, res) => {
  const currentState = getCurrentTimerState();
  currentState.isRunning = false;
  currentState.timeLeft = currentState.isFocus ? 25 * 60 : 5 * 60;
  currentState.lastUpdated = Date.now();
  updateStoredState(currentState);
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/switch', (req, res) => {
  const currentState = getCurrentTimerState();
  currentState.isFocus = !currentState.isFocus;
  currentState.timeLeft = currentState.isFocus ? 25 * 60 : 5 * 60;
  currentState.isRunning = false;
  currentState.lastUpdated = Date.now();
  
  if (currentState.isFocus) {
    currentState.totalSessions += 1;
  }
  
  updateStoredState(currentState);
  res.json({ success: true, state: currentState });
});

app.get('/api/timer/stats', (req, res) => {
  const currentState = getCurrentTimerState();
  const stats = {
    totalSessions: currentState.totalSessions,
    consecutiveSessions: currentState.consecutiveSessions,
    nextLongBreak: Math.max(0, 4 - currentState.consecutiveSessions),
    isLongBreakNext: currentState.consecutiveSessions >= 3
  };
  res.json(stats);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running!',
    timestamp: new Date().toISOString(),
    timerState: getCurrentTimerState()
  });
});

// Export for Vercel
module.exports = app;

// Only listen locally if not in Vercel
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  });
}