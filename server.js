const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser')
const connectDB = require('./config/db')
const authRoutes = require('./routes/auth')
const profileRoutes = require('./routes/profile')
const app = express();

require('dotenv').config();

// CORS - Allow your frontend domain (must be before other middleware)
const corsOptions = {
  origin: [
    'https://pomodoro-next-chi.vercel.app',
    'http://localhost:3000'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type']
};

app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

//mongodb
connectDB()

app.use(express.json());
app.use(cookieParser());

// Import and mount API routes
const timerRoutes = require('./routes/timerRoutes');
app.use('/api', timerRoutes);
app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)

module.exports = app;

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Pomodoro backend listening on port ${PORT}`);
});