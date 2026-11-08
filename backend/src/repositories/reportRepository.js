/**
 * Report repository: the ONLY module that reads or writes `review_reports`.
 *
 * Status flow (review_reports.status):
 *   pending   → a member reported the review; waiting for an administrator
 *   dismissed → an administrator decided the review is fine
 *   removed   → an administrator removed the review. reviewRepository's
 *               VISIBLE_REVIEW hides any review with a 'removed' report.
 *   reviewed  → closed because another report on the same review was acted on
 *
 * A user can report a given review only once (UNIQUE review_id, reported_by).
 */
import { pool, withTransaction } from '../db.js';
import { TARGET_COLUMNS, TARGET_JOINS, toTarget } from './musicRepository.js';

export class DuplicateReportError extends Error {
  constructor() {
    super('Duplicate report');
    this.name = 'DuplicateReportError';
  }
}

// Reviews are read here regardless of visibility: administrators need to see
// removed reviews to restore them.
const SELECT_REPORTS = `
  SELECT rr.report_id, rr.review_id, rr.reason, rr.details, rr.status, rr.created_at, rr.reviewed_at,
    rep.user_id AS reporter_id, rep.username AS reporter_username,
    mod_u.username AS moderator_username,
    t.review_text, t.created_at AS review_created_at,
    au.user_id AS author_id, au.username AS author_username, au.display_name AS author_display_name,
    au.avatar_url AS author_avatar_url, au.account_status AS author_status,
    (SELECT COUNT(*) FROM review_reports o WHERE o.review_id = rr.review_id) AS report_count,
    EXISTS (SELECT 1 FROM review_reports o WHERE o.review_id = rr.review_id AND o.status = 'removed') AS review_removed,
    ${TARGET_COLUMNS}
  FROM review_reports rr
  JOIN reviews t ON t.review_id = rr.review_id
  JOIN users au ON au.user_id = t.user_id
  JOIN users rep ON rep.user_id = rr.reported_by
  LEFT JOIN users mod_u ON mod_u.user_id = rr.reviewed_by
  ${TARGET_JOINS}`;

function toReport(row) {
  return {
    id: row.report_id,
    reason: row.reason,
    details: row.details ?? '',
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.reviewed_at ?? null,
    reporter: { id: row.reporter_id, username: row.reporter_username },
    moderator: row.moderator_username ? { username: row.moderator_username } : null,
    review: {
      id: row.review_id,
      text: row.review_text,
      createdAt: row.review_created_at,
      isRemoved: Boolean(row.review_removed),
      reportCount: Number(row.report_count),
      author: {
        id: row.author_id,
        username: row.author_username,
        displayName: row.author_display_name ?? '',
        avatarUrl: row.author_avatar_url ?? null,
        accountStatus: row.author_status,
      },
      target: toTarget(row),
    },
  };
}

export async function createReport(reviewId, userId, { reason, details }) {
  try {
    const [result] = await pool.execute(
      'INSERT INTO review_reports (review_id, reported_by, reason, details) VALUES (?, ?, ?, ?)',
      [reviewId, userId, reason, details || null],
    );
    return result.insertId;
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw new DuplicateReportError();
    throw err;
  }
}

export async function hasReported(reviewId, userId) {
  const [rows] = await pool.execute('SELECT 1 FROM review_reports WHERE review_id = ? AND reported_by = ? LIMIT 1', [
    reviewId,
    userId,
  ]);
  return rows.length > 0;
}

/** `status` null = every report. Pending ones oldest first (a queue); others newest first. */
export async function listReports({ status = null } = {}) {
  const order = status === 'pending' ? 'rr.created_at ASC, rr.report_id ASC' : 'rr.created_at DESC, rr.report_id DESC';
  const [rows] = status
    ? await pool.execute(`${SELECT_REPORTS} WHERE rr.status = ? ORDER BY ${order} LIMIT 200`, [status])
    : await pool.execute(`${SELECT_REPORTS} ORDER BY ${order} LIMIT 200`);
  return rows.map(toReport);
}

export async function findReportById(reportId) {
  const [rows] = await pool.execute(`${SELECT_REPORTS} WHERE rr.report_id = ?`, [reportId]);
  return rows[0] ? toReport(rows[0]) : null;
}

/** { pending, dismissed, removed, reviewed } */
export async function countByStatus() {
  const [rows] = await pool.execute('SELECT status, COUNT(*) AS total FROM review_reports GROUP BY status');
  const counts = { pending: 0, dismissed: 0, removed: 0, reviewed: 0 };
  for (const row of rows) counts[row.status] = Number(row.total);
  return counts;
}

/** Marks one report dismissed: the review stays up. */
export async function dismissReport(reportId, moderatorId) {
  const [result] = await pool.execute(
    `UPDATE review_reports SET status = 'dismissed', reviewed_by = ?, reviewed_at = UTC_TIMESTAMP()
     WHERE report_id = ? AND status = 'pending'`,
    [moderatorId, reportId],
  );
  return result.affectedRows > 0;
}

/**
 * Removes the reported review: this report becomes 'removed' (which hides the
 * review everywhere) and other open reports on the same review are closed.
 */
export function removeReportedReview(reportId, reviewId, moderatorId) {
  return withTransaction(async (conn) => {
    await conn.execute(
      `UPDATE review_reports SET status = 'removed', reviewed_by = ?, reviewed_at = UTC_TIMESTAMP() WHERE report_id = ?`,
      [moderatorId, reportId],
    );
    await conn.execute(
      `UPDATE review_reports SET status = 'reviewed', reviewed_by = ?, reviewed_at = UTC_TIMESTAMP()
       WHERE review_id = ? AND status = 'pending'`,
      [moderatorId, reviewId],
    );
  });
}

/** Puts a removed review back: its 'removed' reports become 'dismissed'. */
export async function restoreReview(reviewId, moderatorId) {
  const [result] = await pool.execute(
    `UPDATE review_reports SET status = 'dismissed', reviewed_by = ?, reviewed_at = UTC_TIMESTAMP()
     WHERE review_id = ? AND status = 'removed'`,
    [moderatorId, reviewId],
  );
  return result.affectedRows > 0;
}
