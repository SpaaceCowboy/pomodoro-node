require('dotenv').config();
require('./config/env').validateEnvironment();

const { setupErrorHandler, captureException } = require('./config/observability');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const { connectDB, disconnectDB } = require('./config/db');
const { runMigrations } = require('./db/migrate');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const settingsRoutes = require('./routes/settings');
const pushRoutes = require('./routes/push');
const socialRoutes = require('./routes/social');
const publicProfileRoutes = require('./routes/publicProfile');
const {
  logger,
  requestLogger,
  requestMetrics,
  metricsHandler,
} = require('./middleware/observability');
const app = express();
let httpServer;
let shutdownPromise;

const isProduction = process.env.NODE_ENV === 'production';

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(requestLogger);
app.use(requestMetrics);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    strictTransportSecurity: isProduction
      ? { maxAge: 31536000, includeSubDomains: true, preload: true }
      : false,
  })
);
app.use(express.json({ limit: '1mb' }));
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Accept'],
};

app.use(cors(corsOptions));

// Connect and apply versioned PostgreSQL migrations before setting up routes.
const startServer = async () => {
  try {
    const connected = await connectDB();
    if (connected) await runMigrations();

    // Import and mount API routes
    const timerRoutes = require('./routes/timerRoutes');
    app.use('/api', timerRoutes);
    app.use('/api/auth', authRoutes);
    app.use('/api/profile', profileRoutes);
    app.use('/api/push', pushRoutes);
    app.use('/api/social', socialRoutes);
    app.use('/api/public', publicProfileRoutes);
    app.use('/api/settings', settingsRoutes);
    app.get('/api/metrics', metricsHandler);

    setupErrorHandler(app);

    // Error handling middleware
    app.use((err, _req, res, _next) => {
      captureException(err, { requestId: _req.id });
      _req.log?.error({ err }, 'Request failed');
      const status = err.status || 500;
      res.status(status).json({
        message: status < 500 ? err.message : 'Internal Server Error',
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
      httpServer = app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Pomodoro backend listening');
      });
    }
  } catch (error) {
    captureException(error, { phase: 'startup' });
    logger.fatal({ err: error }, 'Failed to start server');
    if (process.env.VERCEL === '1') throw error;
    process.exit(1);
  }
};

async function shutdown(signal = 'shutdown') {
  if (shutdownPromise) return shutdownPromise;

  shutdownPromise = (async () => {
    logger.info({ signal }, 'Shutting down gracefully');

    if (httpServer) {
      await Promise.race([
        new Promise((resolve, reject) => {
          httpServer.close((err) => (err ? reject(err) : resolve()));
        }),
        new Promise((resolve) => {
          const timeout = setTimeout(() => {
            httpServer.closeAllConnections?.();
            resolve();
          }, 10_000);
          timeout.unref();
        }),
      ]);
    }

    await disconnectDB();
  })();

  return shutdownPromise;
}

function handleSignal(signal) {
  shutdown(signal).catch((err) => {
    captureException(err, { phase: 'shutdown', signal });
    logger.error({ err, signal }, 'Graceful shutdown failed');
    process.exitCode = 1;
  });
}

if (process.env.VERCEL !== '1') {
  process.once('SIGTERM', () => handleSignal('SIGTERM'));
  process.once('SIGINT', () => handleSignal('SIGINT'));
}

const ready = startServer();

async function serverlessHandler(req, res) {
  try {
    await ready;
    return app(req, res);
  } catch (err) {
    captureException(err, { phase: 'serverless-initialization' });
    logger.error({ err }, 'Serverless initialization failed');
    if (!res.headersSent) {
      return res.status(503).json({ message: 'Service temporarily unavailable' });
    }
    return res.end();
  }
}

const exportedHandler = process.env.VERCEL === '1' ? serverlessHandler : app;
exportedHandler.app = app;
exportedHandler.ready = ready;
exportedHandler.shutdown = shutdown;

module.exports = exportedHandler;
