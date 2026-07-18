// Postgres (Neon, via Vercel's Storage Marketplace) connection layer.
//
// The rest of this app was originally written against mysql2's calling
// convention: `const [rows] = await pool.query(sql, params)`, `?` placeholders,
// `result.insertId`, `result.affectedRows`, and `pool.getConnection()` for
// transactions. Rather than rewrite every route file's calling style, this
// module wraps node-postgres (`pg`) so it behaves the same way from the
// outside — routes stay almost untouched; only the raw SQL text differs
// where MySQL and Postgres syntax genuinely diverge (that's handled in the
// route files themselves, not here).
const { Pool, types } = require('pg');
require('dotenv').config();

// Return DATE columns as plain 'YYYY-MM-DD' strings instead of pg's default
// of parsing them into JS Date objects. This matches how the app already
// expects dates to look (and sidesteps a classic node-postgres gotcha where
// DATE-only values can shift by a day depending on how they're printed).
types.setTypeParser(1082, (val) => val); // 1082 = OID for the 'date' type

const connectionString =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL;

if (!connectionString) {
  console.error('No DATABASE_URL / POSTGRES_URL environment variable is set — cannot connect to the database.');
}

// Neon (and most managed Postgres hosts) require SSL. Detect it from the
// connection string, an explicit DB_SSL=true, or just assume it's needed on
// Vercel, where this is running against Neon.
const useSsl =
  process.env.DB_SSL === 'true' ||
  (connectionString || '').includes('sslmode=require') ||
  !!process.env.VERCEL;

// Vercel functions are short-lived and can run many instances in parallel,
// so a large per-instance pool (fine for one always-on process) can exhaust
// a managed Postgres host's connection limit. Keep it small there.
const max = Number(process.env.DB_CONNECTION_LIMIT) || (process.env.VERCEL ? 1 : 10);

const pgPool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false,
  max
});

// Converts a mysql2-style '?' placeholder query into Postgres's positional
// $1, $2, ... syntax. Safe here because none of this app's queries contain a
// literal '?' character inside a string or LIKE pattern — every '?' is a
// placeholder.
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Makes a node-postgres Result look like what mysql2 would have returned,
// so existing route code (`const [rows] = ...`, `result.insertId`,
// `result.affectedRows`) keeps working unchanged.
function wrapResult(result) {
  if (result.command === 'SELECT') {
    return [result.rows, result.fields];
  }
  // INSERT/UPDATE/DELETE. If the query used `RETURNING <id_column>`, expose
  // that single value as `.insertId`, the same way mysql2 does automatically.
  const firstRow = result.rows[0];
  const insertId = firstRow ? Object.values(firstRow)[0] : undefined;
  return [{ affectedRows: result.rowCount, insertId, rows: result.rows }];
}

async function query(sql, params = []) {
  const result = await pgPool.query(toPositional(sql), params);
  return wrapResult(result);
}

// Mirrors mysql2's pool.getConnection() — used for multi-statement
// transactions (see bookings.js). Returns an object with the same
// query/beginTransaction/commit/rollback/release shape.
async function getConnection() {
  const client = await pgPool.connect();
  return {
    query: async (sql, params = []) => {
      const result = await client.query(toPositional(sql), params);
      return wrapResult(result);
    },
    beginTransaction: () => client.query('BEGIN'),
    commit: () => client.query('COMMIT'),
    rollback: () => client.query('ROLLBACK'),
    release: () => client.release()
  };
}

module.exports = { query, getConnection, end: () => pgPool.end() };
