const express = require('express');
const cors = require('cors');

const app = express();

// CORS - Allow your frontend domain
app.use(cors({
  origin: [
    'https://pomodoro-next-chi.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Store timer state
let timerState = {
  isRunning: false,
  isFocus: true,
  timeLeft: 25 * 60,
  totalSessions: 0,
  consecutiveSessions: 0,
  lastUpdated: Date.now()
};

// Calculate current state with elapsed time
const getCurrentState = () => {
  const state = { ...timerState };
  
  if (state.isRunning) {
    const now = Date.now();
    const elapsedSeconds = Math.floor((now - state.lastUpdated) / 1000);
    
    if (elapsedSeconds > 0) {
      state.timeLeft = Math.max(0, state.timeLeft - elapsedSeconds);
      state.lastUpdated = now;
      
      // Timer completed
      if (state.timeLeft <= 0) {
        state.isRunning = false;
        
        if (state.isFocus) {
          // Focus completed - switch to break
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
          // Break completed - switch to focus
          state.isFocus = true;
          state.timeLeft = 25 * 60;
        }
      }
    }
  }
  
  return state;
};

// Update stored state
const updateState = (newState) => {
  timerState = { ...newState };
};

// Routes
app.get('/api/health', (req, res) => {
  const currentState = getCurrentState();
  res.json({ 
    message: 'Backend is working!',
    timestamp: new Date().toISOString(),
    state: currentState
  });
});

app.get('/api/timer/state', (req, res) => {
  const currentState = getCurrentState();
  updateState(currentState);
  res.json(currentState);
});

app.post('/api/timer/start', (req, res) => {
  const currentState = getCurrentState();
  currentState.isRunning = true;
  currentState.lastUpdated = Date.now();
  updateState(currentState);
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/pause', (req, res) => {
  const currentState = getCurrentState();
  currentState.isRunning = false;
  currentState.lastUpdated = Date.now();
  updateState(currentState);
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/reset', (req, res) => {
  const currentState = getCurrentState();
  currentState.isRunning = false;
  currentState.timeLeft = currentState.isFocus ? 25 * 60 : 5 * 60;
  currentState.lastUpdated = Date.now();
  updateState(currentState);
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/switch', (req, res) => {
  const currentState = getCurrentState();
  currentState.isFocus = !currentState.isFocus;
  currentState.timeLeft = currentState.isFocus ? 25 * 60 : 5 * 60;
  currentState.isRunning = false;
  currentState.lastUpdated = Date.now();
  
  if (currentState.isFocus) {
    currentState.totalSessions += 1;
  }
  
  updateState(currentState);
  res.json({ success: true, state: currentState });
});

app.get('/api/timer/stats', (req, res) => {
  const currentState = getCurrentState();
  const stats = {
    totalSessions: currentState.totalSessions,
    consecutiveSessions: currentState.consecutiveSessions,
    nextLongBreak: Math.max(0, 4 - currentState.consecutiveSessions),
    isLongBreakNext: currentState.consecutiveSessions >= 3
  };
  res.json(stats);
});

// Handle preflight requests
app.options('*', cors());

module.exports = app;