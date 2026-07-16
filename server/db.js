const mysql = require('mysql2/promise');
require('dotenv').config();

// Determine if running on Vercel
const isServerless = !!process.env.VERCEL;

// Connection pool size
const connectionLimit =
  Number(process.env.DB_CONNECTION_LIMIT) || (isServerless ? 1 : 10);

// Enable SSL if required
const useSsl =
  process.env.DB_SSL === 'true' ||
  (process.env.DATABASE_URL || '').includes('ssl-mode=REQUIRED');

const baseConfig = {
  waitForConnections: true,
  connectionLimit,
  queueLimit: 0,
  ...(useSsl
    ? {
        ssl: {
          rejectUnauthorized:
            process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        },
      }
    : {}),
};

// Create the connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit,
  queueLimit: 0,
  ssl: {
    rejectUnauthorized: false,
  },
});

module.exports = pool;