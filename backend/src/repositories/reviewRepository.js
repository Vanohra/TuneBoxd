/**
 * Review repository: the ONLY module that reads or writes `reviews` and `ratings`.
 *
 * The team schema keeps the star rating in its own `ratings` table (one per user
 * per album/song) rather than a column on `reviews`. A TuneBoxd review is the
 * pair (review text + rating) for the same user and target; both are written
 * in one transaction so they can't get out of sync.
 *
 * Visibility: a review is hidden from everyone when a moderator marked a
 * report on it as 'removed' (review_reports.status), or when its author's
 * account is suspended. Every read below applies VISIBLE_REVIEW.
 */
import { pool, withTransaction } from '../db.js';
import { TARGET_COLUMNS, TARGET_JOINS, toTarget } from './musicRepository.js';

export const VISIBLE_REVIEW = `u.account_status = 'active'
  AND NOT EXISTS (SELECT 1 FROM review_reports rr WHERE rr.review_id = t.review_id AND rr.status = 'removed')`;

const SELECT_REVIEWS = `
  SELECT t.review_id, t.user_id, t.album_id, t.song_id, t.review_text, t.created_at, t.updated_at,
    u.username, u.display_name, u.avatar_url,
    COALESCE(ra.score, rs.score) AS score,
    (SELECT COUNT(*) FROM comments c JOIN users cu ON cu.user_id = c.user_id
      WHERE c.review_id = t.review_id AND cu.account_status = 'active') AS comment_count,
    ${TARGET_COLUMNS}
  FROM reviews t
  JOIN users u ON u.user_id = t.user_id
  LEFT JOIN ratings ra ON ra.user_id = t.user_id AND ra.album_id = t.album_id
  LEFT JOIN ratings rs ON rs.user_id = t.user_id AND rs.song_id = t.song_id
  ${TARGET_JOINS}`;

function toReview(row) {
  return {
    id: row.review_id,
    text: row.review_text,
    rating: row.score === null ? null : Number(row.score),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    commentCount: Number(row.comment_count),
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name ?? '',
      avatarUrl: row.avatar_url ?? null,
    },
    target: toTarget(row),
  };
}

/** Clamp for LIMIT/OFFSET, which are inlined as integers (mysql2 can't bind them with execute). */
const int = (value, fallback, max) => Math.max(0, Math.min(Number.parseInt(value, 10) || fallback, max));

/** Visible review by ID, or null. */
export async function findReviewById(reviewId) {
  const [rows] = await pool.execute(`${SELECT_REVIEWS} WHERE t.review_id = ? AND ${VISIBLE_REVIEW}`, [reviewId]);
  return rows[0] ? toReview(rows[0]) : null;
}

/** Owner and moderation state of a review, ignoring visibility (for edit checks). */
export async function findReviewOwnership(reviewId) {
  const [rows] = await pool.execute(
    `SELECT t.review_id, t.user_id,
       EXISTS (SELECT 1 FROM review_reports rr WHERE rr.review_id = t.review_id AND rr.status = 'removed') AS is_removed
     FROM reviews t WHERE t.review_id = ?`,
    [reviewId],
  );
  return rows[0] ? { id: rows[0].review_id, userId: rows[0].user_id, isRemoved: Boolean(rows[0].is_removed) } : null;
}

/** @param {{ albumId?: number|null, songId?: number|null }} target */
export async function listReviewsForTarget({ albumId, songId }, { limit = 50, offset = 0 } = {}) {
  const column = albumId ? 't.album_id' : 't.song_id';
  const [rows] = await pool.execute(
    `${SELECT_REVIEWS} WHERE ${column} = ? AND ${VISIBLE_REVIEW}
     ORDER BY t.created_at DESC, t.review_id DESC LIMIT ${int(limit, 50, 100)} OFFSET ${int(offset, 0, 10_000)}`,
    [albumId || songId],
  );
  return rows.map(toReview);
}

export async function listReviewsByUser(userId, { limit = 50, offset = 0 } = {}) {
  const [rows] = await pool.execute(
    `${SELECT_REVIEWS} WHERE t.user_id = ? AND ${VISIBLE_REVIEW}
     ORDER BY t.created_at DESC, t.review_id DESC LIMIT ${int(limit, 50, 100)} OFFSET ${int(offset, 0, 10_000)}`,
    [userId],
  );
  return rows.map(toReview);
}

export async function listRecentReviews({ limit = 10 } = {}) {
  const [rows] = await pool.execute(
    `${SELECT_REVIEWS} WHERE ${VISIBLE_REVIEW} ORDER BY t.created_at DESC, t.review_id DESC LIMIT ${int(limit, 10, 50)}`,
  );
  return rows.map(toReview);
}

export async function countReviewsByUser(userId) {
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM reviews t JOIN users u ON u.user_id = t.user_id WHERE t.user_id = ? AND ${VISIBLE_REVIEW}`,
    [userId],
  );
  return Number(row.total);
}

/** Average star rating and counts for an album or song (ratings by active users only). */
export async function getTargetStats({ albumId, songId }) {
  const column = albumId ? 'album_id' : 'song_id';
  const id = albumId || songId;
  const [[ratingRow]] = await pool.execute(
    `SELECT AVG(r.score) AS average, COUNT(*) AS total FROM ratings r JOIN users u ON u.user_id = r.user_id
     WHERE r.${column} = ? AND u.account_status = 'active'`,
    [id],
  );
  const [[reviewRow]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM reviews t JOIN users u ON u.user_id = t.user_id WHERE t.${column} = ? AND ${VISIBLE_REVIEW}`,
    [id],
  );
  const ratingCount = Number(ratingRow.total);
  return {
    averageRating: ratingCount ? Math.round(Number(ratingRow.average) * 100) / 100 : null,
    ratingCount,
    reviewCount: Number(reviewRow.total),
  };
}

/** The user's existing review ID for a target (visible or not), or null. */
export async function findUserReviewIdForTarget(userId, { albumId, songId }) {
  const column = albumId ? 'album_id' : 'song_id';
  const [rows] = await pool.execute(`SELECT review_id FROM reviews WHERE user_id = ? AND ${column} = ? LIMIT 1`, [
    userId,
    albumId || songId,
  ]);
  return rows[0]?.review_id ?? null;
}

export class DuplicateReviewError extends Error {
  constructor() {
    super('Duplicate review');
    this.name = 'DuplicateReviewError';
  }
}


async function upsertRating(conn, userId, { albumId, songId }, score) {
  await conn.execute(
    `INSERT INTO ratings (user_id, album_id, song_id, score) VALUES (?, ?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE score = new.score`,
    [userId, albumId ?? null, songId ?? null, score],
  );
}

/** @returns new review_id. Throws DuplicateReviewError if the user already reviewed this target. */
export function createReview(userId, target, { text, rating }) {
  return withTransaction(async (conn) => {
    let result;
    try {
      [result] = await conn.execute('INSERT INTO reviews (user_id, album_id, song_id, review_text) VALUES (?, ?, ?, ?)', [
        userId,
        target.albumId ?? null,
        target.songId ?? null,
        text,
      ]);
    } catch (err) {
      // UNIQUE (user_id, album_id) / (user_id, song_id): one review per user per item.
      if (err.code === 'ER_DUP_ENTRY') throw new DuplicateReviewError();
      throw err;
    }
    await upsertRating(conn, userId, target, rating);
    return result.insertId;
  });
}

/**
 * Updates text and rating. created_at is never touched; updated_at is set
 * explicitly so it also changes when only the rating changed.
 */
export function updateReview(reviewId, userId, { text, rating }) {
  return withTransaction(async (conn) => {
    const [[row]] = await conn.execute(
      'SELECT album_id, song_id FROM reviews WHERE review_id = ? AND user_id = ? FOR UPDATE',
      [reviewId, userId],
    );
    if (!row) return false;
    await conn.execute('UPDATE reviews SET review_text = ?, updated_at = CURRENT_TIMESTAMP WHERE review_id = ?', [
      text,
      reviewId,
    ]);
    await upsertRating(conn, userId, { albumId: row.album_id, songId: row.song_id }, rating);
    return true;
  });
}

/**
 * Deletes a review and the matching rating. Its comments, likes and reports go
 * with it through ON DELETE CASCADE, so nothing is left pointing at it.
 */
export function deleteReview(reviewId, userId) {
  return withTransaction(async (conn) => {
    const [[row]] = await conn.execute(
      'SELECT album_id, song_id FROM reviews WHERE review_id = ? AND user_id = ? FOR UPDATE',
      [reviewId, userId],
    );
    if (!row) return false;
    await conn.execute('DELETE FROM reviews WHERE review_id = ?', [reviewId]);
    const column = row.album_id ? 'album_id' : 'song_id';
    await conn.execute(`DELETE FROM ratings WHERE user_id = ? AND ${column} = ?`, [userId, row.album_id ?? row.song_id]);
    return true;
  });
}
