/**
 * Comment repository: the ONLY module that reads or writes `comments`.
 * comments.review_id has ON DELETE CASCADE, so deleting a review deletes its
 * comments too and no orphaned comments can be shown.
 */
import { pool } from '../db.js';

const SELECT_COMMENTS = `
  SELECT c.comment_id, c.review_id, c.user_id, c.comment_text, c.created_at, c.updated_at,
    u.username, u.display_name, u.avatar_url
  FROM comments c
  JOIN users u ON u.user_id = c.user_id`;

function toComment(row) {
  return {
    id: row.comment_id,
    reviewId: row.review_id,
    text: row.comment_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    author: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name ?? '',
      avatarUrl: row.avatar_url ?? null,
    },
  };
}

/** Comments by active users, oldest first (reads like a conversation). */
export async function listCommentsForReview(reviewId) {
  const [rows] = await pool.execute(
    `${SELECT_COMMENTS} WHERE c.review_id = ? AND u.account_status = 'active'
     ORDER BY c.created_at ASC, c.comment_id ASC LIMIT 500`,
    [reviewId],
  );
  return rows.map(toComment);
}

export async function findCommentById(commentId) {
  const [rows] = await pool.execute(`${SELECT_COMMENTS} WHERE c.comment_id = ?`, [commentId]);
  return rows[0] ? toComment(rows[0]) : null;
}

export async function createComment(reviewId, userId, text) {
  const [result] = await pool.execute('INSERT INTO comments (review_id, user_id, comment_text) VALUES (?, ?, ?)', [
    reviewId,
    userId,
    text,
  ]);
  return result.insertId;
}

/** @returns true if a comment owned by userId was updated */
export async function updateComment(commentId, userId, text) {
  const [result] = await pool.execute(
    'UPDATE comments SET comment_text = ?, updated_at = CURRENT_TIMESTAMP WHERE comment_id = ? AND user_id = ?',
    [text, commentId, userId],
  );
  return result.affectedRows > 0;
}

/** @returns true if a comment owned by userId was deleted */
export async function deleteComment(commentId, userId) {
  const [result] = await pool.execute('DELETE FROM comments WHERE comment_id = ? AND user_id = ?', [commentId, userId]);
  return result.affectedRows > 0;
}
