/**
 * Diary repository: the ONLY module that reads or writes `diary_entries` and
 * the diary privacy setting in `user_settings`.
 *
 * diary_entries.listened_at (DATETIME) is the day the user listened, picked in
 * the form. It is separate from created_at/updated_at, which record when the
 * row was written. TuneBoxd logs whole days, so listened_at is stored as
 * midnight and read back as a plain "YYYY-MM-DD" string (no time zone shifts).
 *
 * There is no unique key on (user, album), so the same album can be logged
 * many times on different (or the same) days.
 */
import { pool } from '../db.js';
import { TARGET_COLUMNS, TARGET_JOINS, toTarget } from './musicRepository.js';

const SELECT_ENTRIES = `
  SELECT t.diary_entry_id, t.user_id, DATE_FORMAT(t.listened_at, '%Y-%m-%d') AS listened_on, t.notes,
    t.created_at, t.updated_at,
    ${TARGET_COLUMNS}
  FROM diary_entries t
  ${TARGET_JOINS}`;

function toEntry(row) {
  return {
    id: row.diary_entry_id,
    userId: row.user_id,
    listenedOn: row.listened_on,
    notes: row.notes ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? null,
    target: toTarget(row),
  };
}

const toDatetime = (listenedOn) => `${listenedOn} 00:00:00`;

/** Newest listening date first; entries on the same day newest-logged first. */
export async function listEntriesByUser(userId) {
  const [rows] = await pool.execute(
    `${SELECT_ENTRIES} WHERE t.user_id = ? ORDER BY t.listened_at DESC, t.diary_entry_id DESC LIMIT 1000`,
    [userId],
  );
  return rows.map(toEntry);
}

export async function countEntriesByUser(userId) {
  const [[row]] = await pool.execute('SELECT COUNT(*) AS total FROM diary_entries WHERE user_id = ?', [userId]);
  return Number(row.total);
}

export async function findEntryById(entryId) {
  const [rows] = await pool.execute(`${SELECT_ENTRIES} WHERE t.diary_entry_id = ?`, [entryId]);
  return rows[0] ? toEntry(rows[0]) : null;
}

export async function createEntry(userId, { albumId, songId }, { listenedOn, notes }) {
  const [result] = await pool.execute(
    'INSERT INTO diary_entries (user_id, album_id, song_id, listened_at, notes) VALUES (?, ?, ?, ?, ?)',
    [userId, albumId ?? null, songId ?? null, toDatetime(listenedOn), notes || null],
  );
  return result.insertId;
}

/** @returns true if an entry owned by userId was updated */
export async function updateEntry(entryId, userId, { listenedOn, notes }) {
  const [result] = await pool.execute(
    `UPDATE diary_entries SET listened_at = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
     WHERE diary_entry_id = ? AND user_id = ?`,
    [toDatetime(listenedOn), notes || null, entryId, userId],
  );
  return result.affectedRows > 0;
}

/** @returns true if an entry owned by userId was deleted */
export async function deleteEntry(entryId, userId) {
  const [result] = await pool.execute('DELETE FROM diary_entries WHERE diary_entry_id = ? AND user_id = ?', [
    entryId,
    userId,
  ]);
  return result.affectedRows > 0;
}

/** 'public' | 'private'. Users without a user_settings row get the schema default, 'public'. */
export async function getDiaryVisibility(userId) {
  const [rows] = await pool.execute('SELECT diary_visibility FROM user_settings WHERE user_id = ?', [userId]);
  return rows[0]?.diary_visibility ?? 'public';
}

export async function setDiaryVisibility(userId, visibility) {
  await pool.execute(
    `INSERT INTO user_settings (user_id, diary_visibility) VALUES (?, ?) AS new
     ON DUPLICATE KEY UPDATE diary_visibility = new.diary_visibility`,
    [userId, visibility],
  );
}
