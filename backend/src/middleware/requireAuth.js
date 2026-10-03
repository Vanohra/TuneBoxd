import { getUserById } from '../services/userService.js';

/**
 * Server-side protection for authenticated routes.
 * Returns 401 when there is no valid session; the frontend then redirects to /login.
 * On success, attaches the safe user record to req.currentUser.
 */
export async function requireAuth(req, res, next) {
  const userId = req.session?.userId;
  if (!userId) {
    return res.status(401).json({ error: 'You must be logged in to do that.' });
  }

  const user = await getUserById(userId);
  if (!user) {
    // The session points at a user that no longer exists (e.g. the temporary
    // store was reset). Drop the stale session.
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }

  req.currentUser = user;
  next();
}
