/**
 * Recommendation repository: the ONLY module that reads or writes
 * `recommendations` and `listening_summaries`, plus the read-only candidate
 * queries that pick what to recommend.
 *
 * Recommendations come from TuneBoxd's own catalog (albums someone has already
 * rated, reviewed, logged or listed), so every one links to a working album page.
 * An album counts as "already known" to a user once they've rated it, logged it
 * (directly or through one of its songs) or put it in one of their lists.
 */
import { pool, withTransaction } from '../db.js';
import { TARGET_COLUMNS, TARGET_JOINS, toTarget } from './musicRepository.js';

const NOT_KNOWN = (column) => `${column} NOT IN (
    SELECT album_id FROM ratings WHERE user_id = ? AND album_id IS NOT NULL
    UNION SELECT album_id FROM diary_entries WHERE user_id = ? AND album_id IS NOT NULL
    UNION SELECT s.album_id FROM diary_entries d JOIN songs s ON s.song_id = d.song_id
      WHERE d.user_id = ? AND s.album_id IS NOT NULL
    UNION SELECT la.album_id FROM list_albums la JOIN lists l ON l.list_id = la.list_id WHERE l.user_id = ?
  )`;
const knownParams = (userId) => [userId, userId, userId, userId];

const ACTIVE_RATER = "JOIN users ru ON ru.user_id = r.user_id AND ru.account_status = 'active'";

/**
 * "Taste neighbours": members who rated 4+ stars an album this user also rated
 * 4+. Returns albums those members rated 4+ that this user doesn't know yet.
 */
export async function findNeighbourPicks(userId, limit = 10) {
  const [rows] = await pool.execute(
    `SELECT r.album_id, COUNT(DISTINCT r.user_id) AS fans, AVG(r.score) AS average
     FROM ratings mine
     JOIN ratings n ON n.album_id = mine.album_id AND n.user_id <> mine.user_id AND n.score >= 4
     JOIN ratings r ON r.user_id = n.user_id AND r.album_id IS NOT NULL AND r.score >= 4
     ${ACTIVE_RATER}
     WHERE mine.user_id = ? AND mine.album_id IS NOT NULL AND mine.score >= 4
       AND ${NOT_KNOWN('r.album_id')}
     GROUP BY r.album_id ORDER BY fans DESC, average DESC LIMIT ${limit | 0}`,
    [userId, ...knownParams(userId)],
  );
  return rows.map((row) => ({ albumId: row.album_id, fans: Number(row.fans), average: Number(row.average) }));
}

/** Albums rated 4+ by people this user follows. */
export async function findFollowingPicks(userId, limit = 10) {
  const [rows] = await pool.execute(
    `SELECT r.album_id, COUNT(DISTINCT r.user_id) AS fans, AVG(r.score) AS average,
       MIN(ru.username) AS example_username
     FROM follows f
     JOIN ratings r ON r.user_id = f.following_id AND r.album_id IS NOT NULL AND r.score >= 4
     ${ACTIVE_RATER}
     WHERE f.follower_id = ? AND ${NOT_KNOWN('r.album_id')}
     GROUP BY r.album_id ORDER BY fans DESC, average DESC LIMIT ${limit | 0}`,
    [userId, ...knownParams(userId)],
  );
  return rows.map((row) => ({
    albumId: row.album_id,
    fans: Number(row.fans),
    average: Number(row.average),
    username: row.example_username,
  }));
}

/** Artists this user logs most or rates highly: [{ artistId, name }]. */
export async function findFavouriteArtists(userId, limit = 5) {
  const [rows] = await pool.execute(
    `SELECT ar.artist_id, ar.name, SUM(x.weight) AS weight FROM (
       SELECT COALESCE(al.artist_id, s.artist_id) AS artist_id, 1 AS weight
       FROM diary_entries d
       LEFT JOIN albums al ON al.album_id = d.album_id
       LEFT JOIN songs s ON s.song_id = d.song_id
       WHERE d.user_id = ?
       UNION ALL
       SELECT COALESCE(al.artist_id, s.artist_id), 2
       FROM ratings r
       LEFT JOIN albums al ON al.album_id = r.album_id
       LEFT JOIN songs s ON s.song_id = r.song_id
       WHERE r.user_id = ? AND r.score >= 4
     ) x JOIN artists ar ON ar.artist_id = x.artist_id
     GROUP BY ar.artist_id, ar.name ORDER BY weight DESC LIMIT ${limit | 0}`,
    [userId, userId],
  );
  return rows.map((row) => ({ artistId: row.artist_id, name: row.name }));
}

/** Albums by the given artists that this user doesn't know yet. */
export async function findArtistPicks(userId, artistIds, limit = 10) {
  if (artistIds.length === 0) return [];
  const placeholders = artistIds.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT a.album_id, a.artist_id, AVG(r.score) AS average, COUNT(r.rating_id) AS ratings
     FROM albums a LEFT JOIN ratings r ON r.album_id = a.album_id
     WHERE a.artist_id IN (${placeholders}) AND ${NOT_KNOWN('a.album_id')}
     GROUP BY a.album_id, a.artist_id ORDER BY ratings DESC, average DESC LIMIT ${limit | 0}`,
    [...artistIds, ...knownParams(userId)],
  );
  return rows.map((row) => ({ albumId: row.album_id, artistId: row.artist_id }));
}

/** Highest-rated albums across TuneBoxd that this user doesn't know yet. */
export async function findPopularPicks(userId, limit = 10) {
  const [rows] = await pool.execute(
    `SELECT r.album_id, AVG(r.score) AS average, COUNT(*) AS ratings
     FROM ratings r ${ACTIVE_RATER}
     WHERE r.album_id IS NOT NULL AND r.user_id <> ? AND ${NOT_KNOWN('r.album_id')}
     GROUP BY r.album_id ORDER BY average DESC, ratings DESC LIMIT ${limit | 0}`,
    [userId, ...knownParams(userId)],
  );
  return rows.map((row) => ({ albumId: row.album_id, average: Number(row.average), ratings: Number(row.ratings) }));
}

/** The subset of `mbids` (album MBIDs) this user has already rated, logged or listed. */
export async function findKnownAlbumMbids(userId, mbids) {
  if (mbids.length === 0) return new Set();
  const placeholders = mbids.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT a.external_id FROM albums a
     WHERE a.external_id IN (${placeholders}) AND NOT (${NOT_KNOWN('a.album_id')})`,
    [...mbids, ...knownParams(userId)],
  );
  return new Set(rows.map((row) => row.external_id));
}

/** Album details (as `target` objects) keyed by album_id. */
export async function findAlbumTargets(albumIds) {
  if (albumIds.length === 0) return new Map();
  const placeholders = albumIds.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT t.album_id, ${TARGET_COLUMNS}
     FROM (SELECT album_id, NULL AS song_id FROM albums WHERE album_id IN (${placeholders})) t ${TARGET_JOINS}`,
    albumIds,
  );
  return new Map(rows.map((row) => [row.album_id, toTarget(row)]));
}

// ---------- Stored recommendations ----------

export async function listRecommendations(userId) {
  const [rows] = await pool.execute(
    `SELECT t.recommendation_id, t.reason, t.generated_at, ${TARGET_COLUMNS}
     FROM recommendations t ${TARGET_JOINS}
     WHERE t.user_id = ? ORDER BY t.recommendation_id`,
    [userId],
  );
  return rows.map((row) => ({
    id: row.recommendation_id,
    reason: row.reason ?? '',
    generatedAt: row.generated_at,
    target: toTarget(row),
  }));
}

/** Replaces the user's saved recommendations with `items` ([{ albumId, reason }]). */
export function replaceRecommendations(userId, items) {
  return withTransaction(async (conn) => {
    await conn.execute('DELETE FROM recommendations WHERE user_id = ?', [userId]);
    for (const item of items) {
      await conn.execute('INSERT INTO recommendations (user_id, album_id, reason) VALUES (?, ?, ?)', [
        userId,
        item.albumId,
        item.reason,
      ]);
    }
  });
}

// ---------- Listening summaries ----------

function toSummary(row) {
  return {
    id: row.summary_id,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    text: row.summary_text,
    generatedAt: row.generated_at,
  };
}

const SELECT_SUMMARIES = `SELECT summary_id, user_id, DATE_FORMAT(period_start, '%Y-%m-%d') AS period_start,
  DATE_FORMAT(period_end, '%Y-%m-%d') AS period_end, summary_text, generated_at FROM listening_summaries`;

export async function listSummaries(userId) {
  const [rows] = await pool.execute(
    `${SELECT_SUMMARIES} WHERE user_id = ? ORDER BY generated_at DESC, summary_id DESC LIMIT 50`,
    [userId],
  );
  return rows.map(toSummary);
}

export async function createSummary(userId, { periodStart, periodEnd, text }) {
  const [result] = await pool.execute(
    'INSERT INTO listening_summaries (user_id, period_start, period_end, summary_text) VALUES (?, ?, ?, ?)',
    [userId, periodStart, periodEnd, text],
  );
  const [rows] = await pool.execute(`${SELECT_SUMMARIES} WHERE summary_id = ?`, [result.insertId]);
  return toSummary(rows[0]);
}

export async function deleteSummary(summaryId, userId) {
  const [result] = await pool.execute('DELETE FROM listening_summaries WHERE summary_id = ? AND user_id = ?', [
    summaryId,
    userId,
  ]);
  return result.affectedRows > 0;
}
