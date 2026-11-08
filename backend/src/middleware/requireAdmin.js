import { requireAuth } from './requireAuth.js';

/**
 * Server-side protection for administrator routes. Runs requireAuth first, so
 * the role checked here was just re-read from MySQL (never trusted from the
 * session or the browser). Non-admins get 403.
 */
export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, () => {
    if (req.currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can do that.' });
    }
    next();
  });
}
