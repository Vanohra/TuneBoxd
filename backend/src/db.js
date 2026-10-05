/**
 * MySQL connection pool (Amazon RDS, database `music_review_app`).
 *
 * One pool is shared by the whole app. Each query borrows a connection and
 * returns it, so requests don't open a new connection every time.
 * Only repository files should import this module.
 */
import mysql from 'mysql2/promise';
import { config, missingDbVariables } from './config.js';

export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  connectTimeout: 10_000,
  // TIMESTAMP columns are stored in UTC (the RDS default time zone), so read
  // them back as UTC instead of this machine's local time zone.
  timezone: 'Z',
  enableKeepAlive: true,
});

// mysql2 error codes that mean "the database can't be reached / used right now",
// as opposed to a bug in a query.
const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EHOSTUNREACH',
  'PROTOCOL_CONNECTION_LOST',
  'PROTOCOL_SEQUENCE_TIMEOUT',
  'ER_ACCESS_DENIED_ERROR',
  'ER_BAD_DB_ERROR',
  'ER_CON_COUNT_ERROR',
]);

export function isDatabaseUnavailable(err) {
  return Boolean(err && UNAVAILABLE_CODES.has(err.code));
}

/** True for any error that came from mysql2 / the MySQL server. */
export function isDatabaseError(err) {
  return Boolean(err && (err.sqlState || err.errno || UNAVAILABLE_CODES.has(err.code)));
}

// Helpful hints for startup failures. Deliberately never prints host, user or password.
const HINTS = {
  ER_ACCESS_DENIED_ERROR: 'Check DB_USER and DB_PASSWORD in .env.',
  ER_BAD_DB_ERROR: 'Check DB_NAME in .env (expected music_review_app).',
  ENOTFOUND: 'Check DB_HOST in .env (the RDS endpoint hostname).',
  EAI_AGAIN: 'Check DB_HOST in .env and your internet connection.',
  ETIMEDOUT:
    'The RDS instance did not answer. Check that it is running, publicly accessible, and that its security group allows your IP on DB_PORT.',
  ECONNREFUSED: 'Connection refused. Check DB_HOST and DB_PORT in .env.',
};

/**
 * Runs `SELECT 1` so a startup failure clearly says "can't reach the database"
 * rather than surfacing later as a confusing login error.
 * Throws an Error with a safe, human-readable message on failure.
 */
export async function verifyDatabaseConnection() {
  const missing = missingDbVariables();
  if (missing.length > 0) {
    throw new Error(`Missing database environment variables: ${missing.join(', ')}. See .env.example.`);
  }
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    const hint = HINTS[err.code] || 'Check the DB_* values in .env and that the RDS instance is running.';
    throw new Error(`Unable to connect to database (${err.code || 'unknown error'}). ${hint}`);
  }
}
