/**
 * Gives an existing account administrator access (feature #15), or removes it.
 * There is deliberately no way to do this from the website until an admin
 * exists, so the first administrator is created with this script:
 *
 *   npm --prefix backend run make-admin -- <username>
 *   npm --prefix backend run make-admin -- <username> --revoke
 *
 * After that, administrators can promote others from the Admin page.
 */
import { pool } from '../src/db.js';
import { missingDbVariables } from '../src/config.js';

const [username, flag] = process.argv.slice(2);
if (!username) {
  console.error('Usage: npm --prefix backend run make-admin -- <username> [--revoke]');
  process.exit(1);
}
const missing = missingDbVariables();
if (missing.length > 0) {
  console.error(`Missing database environment variables: ${missing.join(', ')}. See .env.example.`);
  process.exit(1);
}

const role = flag === '--revoke' ? 'user' : 'admin';
try {
  const [result] = await pool.execute('UPDATE users SET role = ? WHERE username = ?', [role, username]);
  if (result.affectedRows === 0) {
    console.error(`No account called @${username}.`);
    process.exitCode = 1;
  } else {
    console.log(role === 'admin' ? `@${username} is now an administrator.` : `@${username} is no longer an administrator.`);
  }
} catch (err) {
  console.error(`Failed: ${err.code ?? ''} ${err.sqlMessage ?? err.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
