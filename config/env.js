function validateEnvironment(env = process.env) {
  if (env.NODE_ENV !== 'production') return;

  const errors = [];
  const required = ['DATABASE_URL', 'JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'CORS_ORIGINS'];
  for (const name of required) {
    if (!env[name]?.trim()) errors.push(`${name} is required in production`);
  }

  for (const name of ['JWT_SECRET', 'REFRESH_TOKEN_SECRET']) {
    if (env[name] && Buffer.byteLength(env[name], 'utf8') < 32) {
      errors.push(`${name} must be at least 32 bytes`);
    }
  }
  if (env.JWT_SECRET && env.JWT_SECRET === env.REFRESH_TOKEN_SECRET) {
    errors.push('JWT_SECRET and REFRESH_TOKEN_SECRET must be different');
  }

  if (env.DATABASE_URL && !/^postgres(?:ql)?:\/\//.test(env.DATABASE_URL)) {
    errors.push('DATABASE_URL must use postgres:// or postgresql://');
  }

  for (const name of ['PG_POOL_MAX', 'PG_CONNECT_TIMEOUT_MS', 'PG_IDLE_TIMEOUT_MS']) {
    if (env[name] !== undefined) {
      const value = Number(env[name]);
      if (!Number.isInteger(value) || value < 1) errors.push(`${name} must be a positive integer`);
    }
  }

  for (const origin of String(env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)) {
    try {
      const url = new URL(origin);
      if (url.origin !== origin || url.protocol !== 'https:') {
        errors.push(`CORS origin must be an HTTPS origin without a path: ${origin}`);
      }
    } catch {
      errors.push(`Invalid CORS origin: ${origin}`);
    }
  }

  if (env.PORT) {
    const port = Number(env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) errors.push('PORT must be 1-65535');
  }

  const sameSite = String(env.REFRESH_COOKIE_SAMESITE || 'none').toLowerCase();
  if (!['lax', 'strict', 'none'].includes(sameSite)) {
    errors.push('REFRESH_COOKIE_SAMESITE must be lax, strict, or none');
  }
  if (sameSite === 'none' && env.REFRESH_COOKIE_SECURE === 'false') {
    errors.push('SameSite=None cookies must be Secure');
  }

  if (env.SENTRY_TRACES_SAMPLE_RATE) {
    const rate = Number(env.SENTRY_TRACES_SAMPLE_RATE);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) {
      errors.push('SENTRY_TRACES_SAMPLE_RATE must be between 0 and 1');
    }
  }

  if (env.METRICS_TOKEN && Buffer.byteLength(env.METRICS_TOKEN, 'utf8') < 32) {
    errors.push('METRICS_TOKEN must be at least 32 bytes when configured');
  }

  const vapidValues = [env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY, env.VAPID_SUBJECT];
  if (vapidValues.some(Boolean) && !vapidValues.every(Boolean)) {
    errors.push(
      'VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT must be configured together'
    );
  }

  if (errors.length) {
    const error = new Error(`Invalid production environment:\n- ${errors.join('\n- ')}`);
    error.code = 'INVALID_ENVIRONMENT';
    throw error;
  }
}

module.exports = { validateEnvironment };
