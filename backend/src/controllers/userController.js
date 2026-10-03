import * as userService from '../services/userService.js';

// GET /api/me (requireAuth has already loaded the user)
export function getCurrentUser(req, res) {
  res.json({ user: req.currentUser });
}

// PATCH /api/me
export async function updateCurrentUser(req, res) {
  // The session only holds the user ID, so the session itself doesn't need to
  // change after a username/email edit. Later requests read the fresh values.
  const user = await userService.updateProfile(req.currentUser.id, req.body ?? {});
  res.json({ user, message: 'Profile updated.' });
}
