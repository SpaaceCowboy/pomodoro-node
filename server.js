const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser')
const connectDB = require('./config/db')
const authRoutes = require('./routes/auth')
const profileRoutes = require('./routes/profile')
const app = express();

require('dotenv').config();


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

//mongodb
connectDB()

app.use(express.json());


// Import and mount API routes
const timerRoutes = require('./routes/timerRoutes');
app.use('/api', timerRoutes);
app.use('/api/auth', authRoutes)
app.use('/api/profile', profileRoutes)
//HTTP-only cookies
app.use(cookieParser())

// Handle preflight requests
app.options('*', cors());

module.exports = app;

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Pomodoro backend listening on port ${PORT}`);
});