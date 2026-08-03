const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    // Production configuration is validated before startup. Local development
    // retains a convenient database fallback.
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pomodoro';
    await mongoose.connect(mongoURI);
    logger.info('MongoDB connected');
  } catch (err) {
    logger.error({ err }, 'MongoDB connection error');

    // This app relies on MongoDB for auth (users, refresh token rotation, timer persistence).
    // Default: fail fast. Set REQUIRE_DB=false to override (not recommended).
    if (process.env.REQUIRE_DB !== 'false') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;
