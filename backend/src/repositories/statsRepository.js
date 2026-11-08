/**
 * Listening statistics (feature #19), computed from `diary_entries` with the
 * music and rating tables. Read-only: nothing here writes.
 *
 * Every query takes an optional { start, end } period ("YYYY-MM-DD", both
 * inclusive) so the same numbers can feed listening summaries (#14).
 * An entry's artist is the album's primary artist for album entries and the
 * song's artist for song entries.
 */
import { pool } from '../db.js';

/** WHERE fragment + values for a user's diary entries in an optional period. */
function diaryScope(userId, { start, end } = {}) {
  const clauses = ['d.user_id = ?'];
  const values = [userId];
  if (start) {
    clauses.push('d.listened_at >= ?');
    values.push(`${start} 00:00:00`);
  }
  if (end) {
    clauses.push('d.listened_at < DATE_ADD(?, INTERVAL 1 DAY)');
    values.push(`${end} 00:00:00`);
  }
  return { where: clauses.join(' AND '), values };
}

const ENTRY_ARTIST_JOINS = `
  LEFT JOIN albums al ON al.album_id = d.album_id
  LEFT JOIN songs s ON s.song_id = d.song_id
  JOIN artists ar ON ar.artist_id = COALESCE(al.artist_id, s.artist_id)`;

export async function getTotals(userId, period) {
  const { where, values } = diaryScope(userId, period);
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS entries,
       COUNT(DISTINCT d.album_id) AS distinct_albums,
       COUNT(DISTINCT d.song_id) AS distinct_songs,
       SUM(d.album_id IS NOT NULL) AS album_entries,
       SUM(d.song_id IS NOT NULL) AS song_entries,
       COUNT(DISTINCT DATE(d.listened_at)) AS active_days,
       DATE_FORMAT(MIN(d.listened_at), '%Y-%m-%d') AS first_listen,
       DATE_FORMAT(MAX(d.listened_at), '%Y-%m-%d') AS last_listen
     FROM diary_entries d WHERE ${where}`,
    values,
  );
  const [[artists]] = await pool.execute(
    `SELECT COUNT(DISTINCT ar.artist_id) AS total FROM diary_entries d ${ENTRY_ARTIST_JOINS} WHERE ${where}`,
    values,
  );
  return {
    entries: Number(row.entries),
    distinctAlbums: Number(row.distinct_albums),
    distinctSongs: Number(row.distinct_songs),
    distinctArtists: Number(artists.total),
    albumEntries: Number(row.album_entries ?? 0),
    songEntries: Number(row.song_entries ?? 0),
    activeDays: Number(row.active_days),
    firstListen: row.first_listen ?? null,
    lastListen: row.last_listen ?? null,
  };
}

/** Most frequently logged artists: [{ mbid, name, count }]. */
export async function getTopArtists(userId, period, limit = 10) {
  const { where, values } = diaryScope(userId, period);
  const [rows] = await pool.execute(
    `SELECT ar.external_id AS mbid, ar.name, COUNT(*) AS total
     FROM diary_entries d ${ENTRY_ARTIST_JOINS}
     WHERE ${where}
     GROUP BY ar.artist_id, ar.external_id, ar.name
     ORDER BY total DESC, MAX(d.listened_at) DESC, ar.name
     LIMIT ${Math.min(Math.max(1, limit | 0), 50)}`,
    values,
  );
  return rows.map((row) => ({ mbid: row.mbid, name: row.name, count: Number(row.total) }));
}

/** Most frequently logged albums (album entries): [{ mbid, title, artistName, coverUrl, count }]. */
export async function getTopAlbums(userId, period, limit = 5) {
  const { where, values } = diaryScope(userId, period);
  const [rows] = await pool.execute(
    `SELECT al.external_id AS mbid, al.title, al.cover_url, ar.name AS artist_name, COUNT(*) AS total
     FROM diary_entries d
     JOIN albums al ON al.album_id = d.album_id
     JOIN artists ar ON ar.artist_id = al.artist_id
     WHERE ${where}
     GROUP BY al.album_id, al.external_id, al.title, al.cover_url, ar.name
     ORDER BY total DESC, MAX(d.listened_at) DESC, al.title
     LIMIT ${Math.min(Math.max(1, limit | 0), 50)}`,
    values,
  );
  return rows.map((row) => ({
    mbid: row.mbid,
    title: row.title,
    artistName: row.artist_name,
    coverUrl: row.cover_url ?? null,
    count: Number(row.total),
  }));
}

/** Entry counts per month since `fromMonth` ("YYYY-MM"): [{ month: "YYYY-MM", count }] (months with entries only). */
export async function getMonthlyCounts(userId, fromMonth, period) {
  const { where, values } = diaryScope(userId, period);
  const [rows] = await pool.execute(
    `SELECT DATE_FORMAT(d.listened_at, '%Y-%m') AS month, COUNT(*) AS total
     FROM diary_entries d
     WHERE ${where} AND d.listened_at >= ?
     GROUP BY month ORDER BY month`,
    [...values, `${fromMonth}-01 00:00:00`],
  );
  return rows.map((row) => ({ month: row.month, count: Number(row.total) }));
}

/** Entries per weekday, Monday first: [7 numbers]. */
export async function getWeekdayCounts(userId, period) {
  const { where, values } = diaryScope(userId, period);
  const [rows] = await pool.execute(
    `SELECT WEEKDAY(d.listened_at) AS weekday, COUNT(*) AS total FROM diary_entries d WHERE ${where} GROUP BY weekday`,
    values,
  );
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const row of rows) counts[row.weekday] = Number(row.total);
  return counts;
}

/** The user's ratings (optionally only those last changed in the period). */
export async function getRatingStats(userId, { start, end } = {}) {
  const clauses = ['user_id = ?'];
  const values = [userId];
  if (start) {
    clauses.push('updated_at >= ?');
    values.push(`${start} 00:00:00`);
  }
  if (end) {
    clauses.push('updated_at < DATE_ADD(?, INTERVAL 1 DAY)');
    values.push(`${end} 00:00:00`);
  }
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS total, AVG(score) AS average FROM ratings WHERE ${clauses.join(' AND ')}`,
    values,
  );
  const total = Number(row.total);
  return { count: total, average: total ? Math.round(Number(row.average) * 100) / 100 : null };
}

/** Reviews written in the period, with the album/song and rating, newest first. */
export async function getReviewsInPeriod(userId, { start, end } = {}, limit = 20) {
  const values = [userId];
  let range = '';
  if (start) {
    range += ' AND t.created_at >= ?';
    values.push(`${start} 00:00:00`);
  }
  if (end) {
    range += ' AND t.created_at < DATE_ADD(?, INTERVAL 1 DAY)';
    values.push(`${end} 00:00:00`);
  }
  const [rows] = await pool.execute(
    `SELECT t.review_text, COALESCE(al.title, s.title) AS title, COALESCE(ala.name, sa.name) AS artist_name,
       COALESCE(ra.score, rs.score) AS score
     FROM reviews t
     LEFT JOIN albums al ON al.album_id = t.album_id
     LEFT JOIN artists ala ON ala.artist_id = al.artist_id
     LEFT JOIN songs s ON s.song_id = t.song_id
     LEFT JOIN artists sa ON sa.artist_id = s.artist_id
     LEFT JOIN ratings ra ON ra.user_id = t.user_id AND ra.album_id = t.album_id
     LEFT JOIN ratings rs ON rs.user_id = t.user_id AND rs.song_id = t.song_id
     WHERE t.user_id = ?${range}
     ORDER BY t.created_at DESC LIMIT ${Math.min(Math.max(1, limit | 0), 50)}`,
    values,
  );
  return rows.map((row) => ({
    title: row.title,
    artistName: row.artist_name,
    rating: row.score === null ? null : Number(row.score),
    text: row.review_text,
  }));
}
