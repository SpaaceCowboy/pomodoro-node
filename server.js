const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser')
const connectDB = require('./config/db')
const authRoutes = require('./routes/auth')
const profileRoutes = require('./routes/profile')
const app = express();

require('dotenv').config();

// CORS - Allow your frontend domain (must be before other middleware)
const allowedOrigins = [
  'https://pomodoro-next-chi.vercel.app',
  'http://localhost:3000'
];

// Manual CORS middleware for reliable Vercel serverless compatibility
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Check if origin is allowed (handle with/without trailing slash)
  const isAllowed = origin && allowedOrigins.some(allowed => {
    return origin === allowed || origin === allowed + '/' || origin === allowed.replace(/\/$/, '');
  });
  
  if (isAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow requests with no origin
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Also use cors middleware as backup
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

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