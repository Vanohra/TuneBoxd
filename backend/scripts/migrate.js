/**
 * Applies the SQL files in database/migrations/ (in name order) to the database
 * configured in .env. Each migration is written to be safe to re-run.
 *
 *   npm --prefix backend run migrate
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { config, missingDbVariables } from '../src/config.js';

const dir = fileURLToPath(new URL('../../database/migrations/', import.meta.url));

const missing = missingDbVariables();
if (missing.length > 0) {
  console.error(`Missing database environment variables: ${missing.join(', ')}. See .env.example.`);
  process.exit(1);
}

const conn = await mysql.createConnection({ ...config.db, multipleStatements: true });
try {
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.sql')).sort()) {
    await conn.query(readFileSync(dir + file, 'utf8'));
    console.log(`Applied ${file}`);
  }
} catch (err) {
  console.error(`Migration failed: ${err.code ?? ''} ${err.sqlMessage ?? err.message}`);
  process.exitCode = 1;
} finally {
  await conn.end();
}
