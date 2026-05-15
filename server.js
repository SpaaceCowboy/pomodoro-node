const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const settingsRoutes = require('./routes/settings');
const app = express();

require('dotenv').config();

app.use(express.json());
app.use(cookieParser());

// CORS
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : [
      'https://pomodoro-timer-teal-pi.vercel.app',
      'https://pomodorotimer-d9n5.onrender.com',
      'http://localhost:3002',
    ];

const corsOptions = {
  origin: (origin, cb) => {
    // allow same-origin / server-to-server / curl
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin)) return cb(null, true);
    return cb(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));

// mongodb - connect before setting up routes
const startServer = async () => {
  try {
    await connectDB();

    // Import and mount API routes
    const timerRoutes = require('./routes/timerRoutes');
    app.use('/api', timerRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/profile', profileRoutes);
    app.use('/api/settings', settingsRoutes);

    // Error handling middleware
    app.use((err, req, res, next) => {
      console.error('Error:', err);
      res.status(err.status || 500).json({
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
      });
    });

    // 404 handler
    app.use((req, res) => {
      res.status(404).json({ message: 'Route not found' });
    });

    // Only listen if not in serverless environment
    if (process.env.VERCEL !== '1') {
      const PORT = process.env.PORT || 4002;
      app.listen(PORT, () => {
        console.log(`Pomodoro backend listening on port ${PORT}`);
      });
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
