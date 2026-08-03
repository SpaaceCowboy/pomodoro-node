const Sentry = require('@sentry/node');

const enabled = Boolean(process.env.SENTRY_DSN);

if (enabled) {
  const configuredSampleRate = Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1);
  const tracesSampleRate = Number.isFinite(configuredSampleRate)
    ? Math.min(1, Math.max(0, configuredSampleRate))
    : 0.1;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RELEASE_VERSION || undefined,
    tracesSampleRate,
    sendDefaultPii: false,
  });
}

function setupErrorHandler(app) {
  if (enabled) Sentry.setupExpressErrorHandler(app);
}

function captureException(err, context = {}) {
  if (enabled) Sentry.captureException(err, { extra: context });
}

module.exports = { enabled, setupErrorHandler, captureException };
