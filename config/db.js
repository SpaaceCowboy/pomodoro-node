const { Pool } = require('pg');
const logger = require('../utils/logger');

let pool;

function databaseUrl() {
  return process.env.DATABASE_URL || 'postgresql://pomodoro:pomodoro@127.0.0.1:5432/pomodoro';
}

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: databaseUrl(),
      max: Number(process.env.PG_POOL_MAX || 10),
      connectionTimeoutMillis: Number(process.env.PG_CONNECT_TIMEOUT_MS || 5000),
      idleTimeoutMillis: Number(process.env.PG_IDLE_TIMEOUT_MS || 30000),
    });
    pool.on('error', (err) => logger.error({ err }, 'Unexpected PostgreSQL pool error'));
  }
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

async function withTransaction(fn) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function connectDB() {
  try {
    await query('SELECT 1');
    logger.info('PostgreSQL connected');
    return true;
  } catch (err) {
    logger.error({ err }, 'PostgreSQL connection error');
    if (process.env.REQUIRE_DB !== 'false') throw err;
    return false;
  }
}

async function disconnectDB() {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}

module.exports = { connectDB, disconnectDB, getPool, query, withTransaction };
