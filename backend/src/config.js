import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Load the repo-root .env (gitignored) into process.env. Variables that are
// already set in the real environment (e.g. on a hosting platform) win.
const envFile = fileURLToPath(new URL('../../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const isProduction = process.env.NODE_ENV === 'production';

const DEV_SESSION_SECRET = 'tuneboxd-dev-only-secret-change-me';
const sessionSecret = process.env.SESSION_SECRET || DEV_SESSION_SECRET;

if (isProduction && sessionSecret === DEV_SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be set in production.');
}

export const config = {
  isProduction,
  port: Number(process.env.PORT) || 4000,
  session: {
    cookieName: 'tuneboxd.sid',
    secret: sessionSecret,
    cookie: {
      httpOnly: true, // JavaScript in the browser cannot read the cookie
      sameSite: 'lax', // not sent on cross-site POSTs (basic CSRF protection)
      secure: isProduction, // HTTPS-only in production; plain HTTP is fine on localhost
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  },
  // Credentials come only from the environment. Never hardcode or log them.
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'music_review_app',
  },
};

/** Names (never values) of required DB variables that are missing. */
export function missingDbVariables() {
  return ['DB_HOST', 'DB_USER', 'DB_PASSWORD'].filter((name) => !process.env[name]);
}
