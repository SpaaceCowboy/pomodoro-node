const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    // Use MongoDB Atlas connection string from environment, or localhost for development
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/pomodoro';
    await mongoose.connect(mongoURI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    // Don't exit process - allow server to continue without DB for timer endpoints
    // Only exit if DB is critical for your app
    if (process.env.REQUIRE_DB === 'true') {
      process.exit(1);
    }
  }
};

module.exports = connectDB;