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
};
