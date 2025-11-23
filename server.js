const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();

// CORS
app.use(cors());
app.use(express.json());

// State file path
const STATE_FILE = path.join('/tmp', 'pomodoro-state.json');

// Initialize or load state
const loadState = () => {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.log('No existing state file, using default');
  }
  
  // Default state
  return {
    isRunning: false,
    isFocus: true,
    timeLeft: 25 * 60,
    totalSessions: 0,
    consecutiveSessions: 0,
    lastUpdated: Date.now()
  };
};

// Save state
const saveState = (state) => {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
  } catch (error) {
    console.error('Error saving state:', error);
  }
};

// Calculate current state based on elapsed time
const calculateCurrentState = () => {
  const state = loadState();
  
  if (state.isRunning) {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - state.lastUpdated) / 1000);
    
    if (elapsedSeconds > 0) {
      state.timeLeft = Math.max(0, state.timeLeft - elapsedSeconds);
      state.lastUpdated = now;
      
      // Check if timer completed
      if (state.timeLeft <= 0) {
        state.isRunning = false;
        
        // Auto-switch modes
        if (state.isFocus) {
          // Focus completed
          state.isFocus = false;
          state.totalSessions += 1;
          state.consecutiveSessions += 1;
          
          // Check for long break
          if (state.consecutiveSessions >= 4) {
            state.timeLeft = 15 * 60;
            state.consecutiveSessions = 0;
          } else {
            state.timeLeft = 5 * 60;
          }
        } else {
          // Break completed
          state.isFocus = true;
          state.timeLeft = 25 * 60;
        }
      }
    }
  }
  
  saveState(state);
  return state;
};

// Routes
app.get('/api/health', (req, res) => {
  const state = calculateCurrentState();
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    state: state
  });
});

app.get('/api/timer/state', (req, res) => {
  const state = calculateCurrentState();
  res.json(state);
});

app.post('/api/timer/start', (req, res) => {
  const state = calculateCurrentState();
  state.isRunning = true;
  state.lastUpdated = Date.now();
  saveState(state);
  res.json({ success: true, state: state });
});

app.post('/api/timer/pause', (req, res) => {
  const state = calculateCurrentState();
  state.isRunning = false;
  state.lastUpdated = Date.now();
  saveState(state);
  res.json({ success: true, state: state });
});

app.post('/api/timer/reset', (req, res) => {
  const state = calculateCurrentState();
  state.isRunning = false;
  state.timeLeft = state.isFocus ? 25 * 60 : 5 * 60;
  state.lastUpdated = Date.now();
  saveState(state);
  res.json({ success: true, state: state });
});

app.post('/api/timer/switch', (req, res) => {
  const state = calculateCurrentState();
  state.isFocus = !state.isFocus;
  state.timeLeft = state.isFocus ? 25 * 60 : 5 * 60;
  state.isRunning = false;
  state.lastUpdated = Date.now();
  
  if (state.isFocus) {
    state.totalSessions += 1;
  }
  
  saveState(state);
  res.json({ success: true, state: state });
});

app.get('/api/timer/stats', (req, res) => {
  const state = calculateCurrentState();
  const stats = {
    totalSessions: state.totalSessions,
    consecutiveSessions: state.consecutiveSessions,
    nextLongBreak: Math.max(0, 4 - state.consecutiveSessions),
    isLongBreakNext: state.consecutiveSessions >= 3
  };
  res.json(stats);
});

module.exports = app;