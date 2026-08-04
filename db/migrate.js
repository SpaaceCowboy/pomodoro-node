const fs = require('node:fs/promises');
const path = require('node:path');
const { withTransaction } = require('../config/db');

const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrations() {
  const files = (await fs.readdir(migrationsDir)).filter((name) => name.endsWith('.sql')).sort();

  await withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('pomodoro-schema-migrations'))");
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const applied = await client.query('SELECT name FROM schema_migrations');
    const appliedNames = new Set(applied.rows.map((row) => row.name));

    for (const file of files) {
      if (appliedNames.has(file)) continue;
      const sql = await fs.readFile(path.join(migrationsDir, file), 'utf8');
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
    }
  });
}

module.exports = { runMigrations };
