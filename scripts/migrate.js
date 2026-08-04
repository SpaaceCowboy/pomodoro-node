require('dotenv').config();

const { connectDB, disconnectDB } = require('../config/db');
const { runMigrations } = require('../db/migrate');

async function main() {
  await connectDB();
  await runMigrations();
  await disconnectDB();
  process.stdout.write('PostgreSQL migrations are up to date.\n');
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err.message}\n`);
  process.exitCode = 1;
});
