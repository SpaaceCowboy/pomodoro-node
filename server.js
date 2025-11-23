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

// Store timer state (simple in-memory)
let timerState = {
  isRunning: false,
  isFocus: true,
  timeLeft: 25 * 60,
  totalSessions: 0,
  consecutiveSessions: 0
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
      
      // Timer completed
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
          } else {
            timerState.timeLeft = 5 * 60; // 5 minute short break
          }
        } else {
          // Break finished, start focus
          timerState.isFocus = true;
          timerState.timeLeft = 25 * 60;
        }
      }
    }
  }
}, 1000);

// Routes
app.get('/api/timer/state', (req, res) => {
  res.json(timerState);
});

app.post('/api/timer/start', (req, res) => {
  timerState.isRunning = true;
  lastUpdateTime = Date.now();
  res.json({ success: true, state: timerState });
});

app.post('/api/timer/pause', (req, res) => {
  timerState.isRunning = false;
  res.json({ success: true, state: timerState });
});

app.post('/api/timer/reset', (req, res) => {
  timerState.isRunning = false;
  timerState.timeLeft = timerState.isFocus ? 25 * 60 : 5 * 60;
  res.json({ success: true, state: timerState });
});

app.post('/api/timer/switch', (req, res) => {
  timerState.isFocus = !timerState.isFocus;
  timerState.timeLeft = timerState.isFocus ? 25 * 60 : 5 * 60;
  timerState.isRunning = false;
  res.json({ success: true, state: timerState });
});

app.get('/api/timer/stats', (req, res) => {
  const stats = {
    totalSessions: timerState.totalSessions,
    consecutiveSessions: timerState.consecutiveSessions,
    nextLongBreak: Math.max(0, 4 - timerState.consecutiveSessions),
    isLongBreakNext: timerState.consecutiveSessions >= 3
  };
  res.json(stats);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running!',
    timestamp: new Date().toISOString()
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