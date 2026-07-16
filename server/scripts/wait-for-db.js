// Waits for MySQL to accept connections before the app tries to seed/start.
// Used only by docker/entrypoint.sh in the container — not needed for
// running the server directly on a machine with a MySQL already running.
require('dotenv').config();
const mysql = require('mysql2/promise');

const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

async function wait() {
  for (let i = 1; i <= MAX_RETRIES; i++) {
    try {
      const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        port: process.env.DB_PORT || 3306
      });
      await conn.end();
      console.log('Database is ready.');
      return;
    } catch (err) {
      console.log(`Database not ready yet (attempt ${i}/${MAX_RETRIES}): ${err.code || err.message}`);
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
  console.error('Database did not become ready in time — giving up.');
  process.exit(1);
}

wait();
