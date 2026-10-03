/**
 * Follow repository: the ONLY module the rest of the backend uses to read or
 * write follow relationships ("follower follows following").
 *
 * Backed by the TEMPORARY in-memory store in mockUserStore.js. The database
 * teammate only needs to rewrite these function bodies. Every function is
 * async and works with user IDs only.
 */
import { mockFollows } from './mockUserStore.js';

const matches = (followerId, followingId) => (follow) =>
  follow.followerId === followerId && follow.followingId === followingId;

export async function isFollowing(followerId, followingId) {
  // TODO: Replace temporary follow store with database lookup.
  return mockFollows.some(matches(followerId, followingId));
}

/** Idempotent: following someone you already follow is a no-op. */
export async function addFollow(followerId, followingId) {
  // TODO: Replace temporary follow store with database insert (ignore duplicate-key errors).
  if (mockFollows.some(matches(followerId, followingId))) return;
  mockFollows.push({ followerId, followingId, createdAt: new Date().toISOString() });
}

/** Idempotent: unfollowing someone you don't follow is a no-op. */
export async function removeFollow(followerId, followingId) {
  // TODO: Replace temporary follow store with database delete.
  const index = mockFollows.findIndex(matches(followerId, followingId));
  if (index !== -1) mockFollows.splice(index, 1);
}

export async function countFollowers(userId) {
  // TODO: Replace temporary follow store with database count.
  return mockFollows.filter((follow) => follow.followingId === userId).length;
}

export async function countFollowing(userId) {
  // TODO: Replace temporary follow store with database count.
  return mockFollows.filter((follow) => follow.followerId === userId).length;
}

/** @returns IDs of users who follow userId, most recent first */
export async function listFollowerIds(userId) {
  // TODO: Replace temporary follow store with database query.
  return mockFollows
    .filter((follow) => follow.followingId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((follow) => follow.followerId);
}

/** @returns IDs of users that userId follows, most recent first */
export async function listFollowingIds(userId) {
  // TODO: Replace temporary follow store with database query.
  return mockFollows
    .filter((follow) => follow.followerId === userId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((follow) => follow.followingId);
}

/** @returns the subset of candidateIds that followerId follows (for "Following" buttons in lists) */
export async function filterFollowedIds(followerId, candidateIds) {
  // TODO: Replace temporary follow store with database query.
  const candidates = new Set(candidateIds);
  return mockFollows
    .filter((follow) => follow.followerId === followerId && candidates.has(follow.followingId))
    .map((follow) => follow.followingId);
}
