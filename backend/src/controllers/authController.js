import { config } from '../config.js';
import * as authService from '../services/authService.js';

// Wrap express-session's callback APIs so we can await them.
const regenerateSession = (req) =>
  new Promise((resolve, reject) => req.session.regenerate((err) => (err ? reject(err) : resolve())));
const destroySession = (req) =>
  new Promise((resolve, reject) => req.session.destroy((err) => (err ? reject(err) : resolve())));

// POST /api/auth/register
export async function register(req, res) {
  const user = await authService.registerUser(req.body ?? {});
  res.status(201).json({ user, message: 'Account created. You can now log in.' });
}

// POST /api/auth/login
export async function login(req, res) {
  const user = await authService.authenticate(req.body ?? {});
  // Issue a fresh session ID on login to prevent session fixation.
  await regenerateSession(req);
  req.session.userId = user.id; // the only thing the session stores
  res.json({ user });
}

// POST /api/auth/logout
export async function logout(req, res) {
  if (req.session) await destroySession(req);
  const { maxAge, ...cookieOptions } = config.session.cookie;
  res.clearCookie(config.session.cookieName, cookieOptions);
  res.json({ message: 'Logged out.' });
}
