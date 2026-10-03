import * as socialService from '../services/socialService.js';

// Public routes still use the session (if any) to mark "following" state.
const viewerIdOf = (req) => req.session?.userId ?? null;

// GET /api/users
export async function listMembers(req, res) {
  res.json({ users: await socialService.listMembers(viewerIdOf(req)) });
}

// GET /api/users/:username
export async function getProfile(req, res) {
  res.json({ profile: await socialService.getProfile(req.params.username, viewerIdOf(req)) });
}

// GET /api/users/:username/followers
export async function listFollowers(req, res) {
  res.json({ users: await socialService.listFollowers(req.params.username, viewerIdOf(req)) });
}

// GET /api/users/:username/following
export async function listFollowing(req, res) {
  res.json({ users: await socialService.listFollowing(req.params.username, viewerIdOf(req)) });
}

// POST /api/users/:username/follow (requireAuth)
export async function follow(req, res) {
  res.json({ profile: await socialService.follow(req.currentUser.id, req.params.username) });
}

// DELETE /api/users/:username/follow (requireAuth)
export async function unfollow(req, res) {
  res.json({ profile: await socialService.unfollow(req.currentUser.id, req.params.username) });
}
