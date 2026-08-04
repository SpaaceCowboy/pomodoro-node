const { query } = require('../config/db');

async function increment({ key, windowStart, expiresAt }) {
  const result = await query(
    `INSERT INTO rate_limits (key, window_start, count, expires_at)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (key, window_start) DO UPDATE SET
       count = rate_limits.count + 1,
       expires_at = EXCLUDED.expires_at
     RETURNING count`,
    [key, windowStart, expiresAt]
  );

  if (Math.random() < 0.01) {
    query('DELETE FROM rate_limits WHERE expires_at < NOW()').catch(() => {});
  }

  return { count: result.rows[0].count };
}

module.exports = { increment };
