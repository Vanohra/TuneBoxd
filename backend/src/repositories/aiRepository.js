/**
 * AI repository: the ONLY module that reads or writes `review_ai_assessments`
 * (moderation assistant) and `review_digests` (album/song review digests).
 */
import { pool } from '../db.js';
import { VISIBLE_REVIEW } from './reviewRepository.js';

// ---------- Moderation assessments ----------

/** What the AI needs to judge a reported review: its text, what it's about, and every report on it. */
export async function findReviewForAssessment(reviewId) {
  const [[review]] = await pool.execute(
    `SELECT t.review_id, t.review_text, t.updated_at,
       COALESCE(al.title, s.title) AS target_title, COALESCE(ala.name, sa.name) AS target_artist,
       IF(t.album_id IS NULL, 'song', 'album') AS target_type,
       COALESCE(ra.score, rs.score) AS score
     FROM reviews t
     LEFT JOIN albums al ON al.album_id = t.album_id
     LEFT JOIN artists ala ON ala.artist_id = al.artist_id
     LEFT JOIN songs s ON s.song_id = t.song_id
     LEFT JOIN artists sa ON sa.artist_id = s.artist_id
     LEFT JOIN ratings ra ON ra.user_id = t.user_id AND ra.album_id = t.album_id
     LEFT JOIN ratings rs ON rs.user_id = t.user_id AND rs.song_id = t.song_id
     WHERE t.review_id = ?`,
    [reviewId],
  );
  if (!review) return null;
  const [reports] = await pool.execute('SELECT reason, details FROM review_reports WHERE review_id = ? ORDER BY report_id', [
    reviewId,
  ]);
  return {
    id: review.review_id,
    text: review.review_text,
    updatedAt: review.updated_at,
    rating: review.score === null ? null : Number(review.score),
    target: { type: review.target_type, title: review.target_title, artist: review.target_artist },
    reports: reports.map((report) => ({ reason: report.reason, details: report.details ?? '' })),
  };
}

export async function findAssessment(reviewId) {
  const [rows] = await pool.execute('SELECT * FROM review_ai_assessments WHERE review_id = ?', [reviewId]);
  return rows[0] ?? null;
}

export async function saveAssessment(reviewId, { verdict, severity, suggestedAction, explanation, model, reviewUpdatedAt }) {
  await pool.execute(
    `INSERT INTO review_ai_assessments
       (review_id, verdict, severity, suggested_action, explanation, model, review_updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE verdict = new.verdict, severity = new.severity,
       suggested_action = new.suggested_action, explanation = new.explanation,
       model = new.model, review_updated_at = new.review_updated_at, analyzed_at = CURRENT_TIMESTAMP`,
    [reviewId, verdict, severity, suggestedAction, explanation, model, reviewUpdatedAt],
  );
}

// ---------- Review digests ----------

/** Visible reviews of an album or song for the digest: text, rating, newest first. */
export async function listReviewsForDigest({ albumId, songId }, limit = 40) {
  const column = albumId ? 't.album_id' : 't.song_id';
  const [rows] = await pool.execute(
    `SELECT t.review_text, t.updated_at, COALESCE(ra.score, rs.score) AS score
     FROM reviews t
     JOIN users u ON u.user_id = t.user_id
     LEFT JOIN ratings ra ON ra.user_id = t.user_id AND ra.album_id = t.album_id
     LEFT JOIN ratings rs ON rs.user_id = t.user_id AND rs.song_id = t.song_id
     WHERE ${column} = ? AND ${VISIBLE_REVIEW}
     ORDER BY t.updated_at DESC, t.review_id DESC LIMIT ${Math.min(Math.max(1, limit | 0), 100)}`,
    [albumId || songId],
  );
  return rows.map((row) => ({
    text: row.review_text,
    updatedAt: row.updated_at,
    rating: row.score === null ? null : Number(row.score),
  }));
}

/** "In Rainbows by Radiohead (album)" for the AI prompt. */
export async function findTargetLabel({ albumId, songId }) {
  const [[row]] = albumId
    ? await pool.execute(
        'SELECT a.title, ar.name FROM albums a JOIN artists ar ON ar.artist_id = a.artist_id WHERE a.album_id = ?',
        [albumId],
      )
    : await pool.execute(
        'SELECT s.title, ar.name FROM songs s JOIN artists ar ON ar.artist_id = s.artist_id WHERE s.song_id = ?',
        [songId],
      );
  return row ? `${row.title} by ${row.name} (${albumId ? 'album' : 'song'})` : albumId ? 'an album' : 'a song';
}

/** Counts every visible review (not just the ones sent to the AI) for the fingerprint. */
export async function getReviewFingerprint({ albumId, songId }) {
  const column = albumId ? 't.album_id' : 't.song_id';
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS total, MAX(t.updated_at) AS latest
     FROM reviews t JOIN users u ON u.user_id = t.user_id
     WHERE ${column} = ? AND ${VISIBLE_REVIEW}`,
    [albumId || songId],
  );
  const total = Number(row.total);
  const latest = row.latest ? new Date(row.latest).toISOString() : 'none';
  return { total, fingerprint: `${total}:${latest}` };
}

function toDigest(row) {
  const parse = (value) => {
    try {
      const list = JSON.parse(value ?? '[]');
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  };
  return {
    summary: row.summary_text,
    liked: parse(row.liked_points),
    disliked: parse(row.disliked_points),
    overall: row.overall_sentiment,
    reviewCount: Number(row.review_count),
    fingerprint: row.fingerprint,
    generatedAt: row.generated_at,
  };
}

export async function findDigest({ albumId, songId }) {
  const [rows] = await pool.execute(`SELECT * FROM review_digests WHERE ${albumId ? 'album_id' : 'song_id'} = ?`, [
    albumId || songId,
  ]);
  return rows[0] ? toDigest(rows[0]) : null;
}

export async function saveDigest({ albumId, songId }, { summary, liked, disliked, overall, reviewCount, fingerprint, model }) {
  await pool.execute(
    `INSERT INTO review_digests
       (album_id, song_id, summary_text, liked_points, disliked_points, overall_sentiment, review_count, fingerprint, model)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE summary_text = new.summary_text, liked_points = new.liked_points,
       disliked_points = new.disliked_points, overall_sentiment = new.overall_sentiment,
       review_count = new.review_count, fingerprint = new.fingerprint, model = new.model,
       generated_at = CURRENT_TIMESTAMP`,
    [albumId ?? null, songId ?? null, summary, JSON.stringify(liked), JSON.stringify(disliked), overall, reviewCount, fingerprint, model],
  );
}
