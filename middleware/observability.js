const crypto = require('crypto');
const pinoHttp = require('pino-http');
const Prometheus = require('prom-client');
const logger = require('../utils/logger');

const registry = new Prometheus.Registry();
registry.setDefaultLabels({ service: process.env.SERVICE_NAME || 'pomodoro-api' });
Prometheus.collectDefaultMetrics({ register: registry, prefix: 'pomodoro_' });

const requestDuration = new Prometheus.Histogram({
  name: 'pomodoro_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry],
});

const requestCount = new Prometheus.Counter({
  name: 'pomodoro_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

function requestId(req, res) {
  const supplied = String(req.headers['x-request-id'] || '');
  const id = /^[a-zA-Z0-9._-]{8,64}$/.test(supplied) ? supplied : crypto.randomUUID();
  res.setHeader('X-Request-Id', id);
  return id;
}

const requestLogger = pinoHttp({
  logger,
  genReqId: requestId,
  customProps: (req) => ({ requestId: req.id }),
  serializers: {
    req: (req) => ({ id: req.id, method: req.method, url: req.url }),
    res: (res) => ({ statusCode: res.statusCode }),
  },
});

function requestMetrics(req, res, next) {
  const started = process.hrtime.bigint();
  res.once('finish', () => {
    const route = req.route?.path ? `${req.baseUrl || ''}${req.route.path}` : 'unmatched';
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    requestCount.inc(labels);
    requestDuration.observe(labels, Number(process.hrtime.bigint() - started) / 1e9);
  });
  next();
}

function safeTokenMatches(actual, expected) {
  if (!actual || !expected) return false;
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  return (
    actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

async function metricsHandler(req, res) {
  const configuredToken = process.env.METRICS_TOKEN;
  if (process.env.NODE_ENV === 'production') {
    const suppliedToken = String(req.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (!safeTokenMatches(suppliedToken, configuredToken)) {
      return res.status(404).json({ message: 'Route not found' });
    }
  }

  res.set('Content-Type', registry.contentType);
  return res.send(await registry.metrics());
}

module.exports = { logger, registry, requestLogger, requestMetrics, metricsHandler };
