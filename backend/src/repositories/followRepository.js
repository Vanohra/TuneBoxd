/**
 * Follow repository: the ONLY module the rest of the backend uses to read or
 * write the `follows` table ("follower_id follows following_id").
 *
 * Every function is async and works with user IDs (users.user_id) only.
 * The table's primary key (follower_id, following_id) prevents duplicates and
 * its CHECK constraint blocks self-follows; socialService also checks both.
 */
import { pool } from '../db.js';

export async function isFollowing(followerId, followingId) {
  const [rows] = await pool.execute(
    'SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1',
    [followerId, followingId],
  );
  return rows.length > 0;
}

/** Idempotent: following someone you already follow is a no-op. */
export async function addFollow(followerId, followingId) {
  await pool.execute('INSERT IGNORE INTO follows (follower_id, following_id) VALUES (?, ?)', [
    followerId,
    followingId,
  ]);
}

/** Idempotent: unfollowing someone you don't follow is a no-op. */
export async function removeFollow(followerId, followingId) {
  await pool.execute('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [followerId, followingId]);
}

export async function countFollowers(userId) {
  const [[row]] = await pool.execute('SELECT COUNT(*) AS total FROM follows WHERE following_id = ?', [userId]);
  return Number(row.total);
}

export async function countFollowing(userId) {
  const [[row]] = await pool.execute('SELECT COUNT(*) AS total FROM follows WHERE follower_id = ?', [userId]);
  return Number(row.total);
}

/** @returns IDs of users who follow userId, most recent first */
export async function listFollowerIds(userId) {
  const [rows] = await pool.execute(
    'SELECT follower_id FROM follows WHERE following_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows.map((row) => row.follower_id);
}

/** @returns IDs of users that userId follows, most recent first */
export async function listFollowingIds(userId) {
  const [rows] = await pool.execute(
    'SELECT following_id FROM follows WHERE follower_id = ? ORDER BY created_at DESC',
    [userId],
  );
  return rows.map((row) => row.following_id);
}

/** @returns the subset of candidateIds that followerId follows (for "Following" buttons in lists) */
export async function filterFollowedIds(followerId, candidateIds) {
  if (candidateIds.length === 0) return [];
  const placeholders = candidateIds.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${placeholders})`,
    [followerId, ...candidateIds],
  );
  return rows.map((row) => row.following_id);
}
