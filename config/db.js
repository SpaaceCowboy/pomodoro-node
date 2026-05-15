const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use MongoDB Atlas connection string from environment, or localhost for development
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pomodoro';
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);

    // This app relies on MongoDB for auth (users, refresh token rotation, timer persistence).
    // Default: fail fast. Set REQUIRE_DB=false to override (not recommended).
    if (process.env.REQUIRE_DB !== 'false') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
