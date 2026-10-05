import { getSessionUser } from '../services/userService.js';

/**
 * Server-side protection for authenticated routes.
 * Returns 401 when there is no valid session; the frontend then redirects to /login.
 * On success, attaches the safe user record to req.currentUser.
 *
 * The user is re-read from MySQL on every request (the session only holds the
 * user ID), so deleted or suspended accounts lose access immediately.
 */
export async function requireAuth(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'You must be logged in to do that.' });
  }

  let user;
  try {
    user = await getSessionUser(userId);
  } catch (err) {
    // Suspended account: end the session too, then let the error handler reply (403).
    if (err.status === 403) req.session.destroy(() => {});
    throw err;
  }

  if (!user) {
    // The session points at a user that no longer exists. Drop the stale session.
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }

  req.currentUser = user;
  next();
}
