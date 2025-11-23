const express = require('express');
const cors = require('cors');

const app = express();

// CORS - Allow your frontend domain
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://pomodoro-next-chi.vercel.app',
    'https://pomodoro-node.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Store timer state in memory (will reset on serverless cold starts)
let timerState = {
  isRunning: false,
  isFocus: true,
  timeLeft: 25 * 60,
  totalSessions: 0,
  consecutiveSessions: 0,
  lastUpdated: Date.now()
};

// Calculate current state based on elapsed time
const calculateCurrentState = () => {
  const currentState = { ...timerState };
  
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
          // Focus completed
          currentState.isFocus = false;
          currentState.totalSessions += 1;
          currentState.consecutiveSessions += 1;
          
          // Check for long break
          if (currentState.consecutiveSessions >= 4) {
            currentState.timeLeft = 15 * 60;
            currentState.consecutiveSessions = 0;
          } else {
            currentState.timeLeft = 5 * 60;
          }
        } else {
          // Break completed
          currentState.isFocus = true;
          currentState.timeLeft = 25 * 60;
        }
      }
    }
  }
  
  return currentState;
};

// Update stored state
const updateStoredState = (newState) => {
  timerState = { ...newState };
};

// Routes
app.get('/api/timer/state', (req, res) => {
  const currentState = calculateCurrentState();
  updateStoredState(currentState);
  res.json(currentState);
});

app.post('/api/timer/start', (req, res) => {
  const currentState = calculateCurrentState();
  currentState.isRunning = true;
  currentState.lastUpdated = Date.now();
  updateStoredState(currentState);
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/pause', (req, res) => {
  const currentState = calculateCurrentState();
  currentState.isRunning = false;
  currentState.lastUpdated = Date.now();
  updateStoredState(currentState);
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/reset', (req, res) => {
  const currentState = calculateCurrentState();
  currentState.isRunning = false;
  currentState.timeLeft = currentState.isFocus ? 25 * 60 : 5 * 60;
  currentState.lastUpdated = Date.now();
  updateStoredState(currentState);
  res.json({ success: true, state: currentState });
});

app.post('/api/timer/switch', (req, res) => {
  const currentState = calculateCurrentState();
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
  const currentState = calculateCurrentState();
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
  const currentState = calculateCurrentState();
  res.json({ 
    status: 'Server is running!',
    timestamp: new Date().toISOString(),
    state: currentState
  });
});

// Handle preflight requests
app.options('*', cors());

module.exports = app;