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


// Import and mount API routes
const timerRoutes = require('./routes/timerRoutes');
app.use('/api', timerRoutes);

// Handle preflight requests
app.options('*', cors());

module.exports = app;

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Pomodoro backend listening on port ${PORT}`);
});