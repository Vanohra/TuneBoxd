/**
 * List repository: the ONLY module that reads or writes `lists`, `list_albums`
 * and `list_songs`.
 *
 * A list can hold albums and songs. They live in two tables (one per target
 * type, as in the team schema) but share one ordering: `position` is unique
 * across both tables for a list, so reading them back with UNION ALL ... ORDER
 * BY position gives the order the owner chose.
 *
 * Each item gets a `key` like "album-12" or "song-7" (the local row ID). The
 * frontend uses it to remove or reorder items without knowing MySQL IDs mean
 * anything else.
 */
import { pool, withTransaction } from '../db.js';
import { TARGET_COLUMNS, TARGET_JOINS, toTarget } from './musicRepository.js';

const SELECT_LISTS = `
  SELECT l.list_id, l.user_id, l.title, l.description, l.is_public, l.created_at, l.updated_at,
    u.username, u.display_name, u.avatar_url,
    (SELECT COUNT(*) FROM list_albums la WHERE la.list_id = l.list_id)
      + (SELECT COUNT(*) FROM list_songs ls WHERE ls.list_id = l.list_id) AS item_count
  FROM lists l
  JOIN users u ON u.user_id = l.user_id`;

const ITEMS = `(
  SELECT list_id, album_id, NULL AS song_id, position, added_at FROM list_albums
  UNION ALL
  SELECT list_id, NULL AS album_id, song_id, position, added_at FROM list_songs
)`;

function toList(row) {
  return {
    id: row.list_id,
    title: row.title,
    description: row.description ?? '',
    isPublic: Boolean(row.is_public),
    itemCount: Number(row.item_count),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    owner: {
      id: row.user_id,
      username: row.username,
      displayName: row.display_name ?? '',
      avatarUrl: row.avatar_url ?? null,
    },
  };
}

function toItem(row) {
  return {
    key: row.album_id ? `album-${row.album_id}` : `song-${row.song_id}`,
    listId: row.list_id,
    position: row.position,
    addedAt: row.added_at,
    target: toTarget(row),
  };
}

/** "album-12" → { table, column, id }, or null for anything else. */
export function parseItemKey(key) {
  const match = /^(album|song)-(\d{1,10})$/.exec(String(key ?? ''));
  if (!match) return null;
  return match[1] === 'album'
    ? { table: 'list_albums', column: 'album_id', id: Number(match[2]) }
    : { table: 'list_songs', column: 'song_id', id: Number(match[2]) };
}

export async function findListById(listId) {
  const [rows] = await pool.execute(`${SELECT_LISTS} WHERE l.list_id = ? AND u.account_status = 'active'`, [listId]);
  return rows[0] ? toList(rows[0]) : null;
}

/** A user's lists, most recently updated first. `publicOnly` hides private ones. */
export async function listListsByUser(userId, { publicOnly = false } = {}) {
  const [rows] = await pool.execute(
    `${SELECT_LISTS} WHERE l.user_id = ? ${publicOnly ? 'AND l.is_public = TRUE' : ''}
     ORDER BY l.updated_at DESC, l.list_id DESC LIMIT 200`,
    [userId],
  );
  return rows.map(toList);
}

/** Newest public lists from active users that have at least one item (for discovery). */
export async function listRecentPublicLists({ limit = 12 } = {}) {
  const [rows] = await pool.execute(
    `SELECT * FROM (${SELECT_LISTS} WHERE l.is_public = TRUE AND u.account_status = 'active') x
     WHERE x.item_count > 0 ORDER BY x.updated_at DESC, x.list_id DESC LIMIT ${Math.min(Math.max(1, limit | 0), 50)}`,
  );
  return rows.map(toList);
}

export async function countListsByUser(userId, { publicOnly = false } = {}) {
  const [[row]] = await pool.execute(
    `SELECT COUNT(*) AS total FROM lists WHERE user_id = ? ${publicOnly ? 'AND is_public = TRUE' : ''}`,
    [userId],
  );
  return Number(row.total);
}

/** Every item in a list, in the owner's order. */
export async function listItems(listId) {
  const [rows] = await pool.execute(
    `SELECT t.list_id, t.album_id, t.song_id, t.position, t.added_at, ${TARGET_COLUMNS}
     FROM ${ITEMS} t ${TARGET_JOINS}
     WHERE t.list_id = ? ORDER BY t.position IS NULL, t.position, t.added_at`,
    [listId],
  );
  return rows.map(toItem);
}

/** Up to `perList` cover previews per list, for list cards. Map of listId → targets. */
export async function listPreviewTargets(listIds, perList = 4) {
  const previews = new Map(listIds.map((id) => [id, []]));
  if (listIds.length === 0) return previews;
  const placeholders = listIds.map(() => '?').join(', ');
  const [rows] = await pool.execute(
    `SELECT t.list_id, t.album_id, t.song_id, t.position, t.added_at, ${TARGET_COLUMNS}
     FROM ${ITEMS} t ${TARGET_JOINS}
     WHERE t.list_id IN (${placeholders}) ORDER BY t.list_id, t.position IS NULL, t.position, t.added_at`,
    listIds,
  );
  for (const row of rows) {
    const bucket = previews.get(row.list_id);
    if (bucket.length < perList) bucket.push(toTarget(row));
  }
  return previews;
}

/** Lists owned by userId, each flagged with whether it already contains the target. */
export async function listOwnListsWithMembership(userId, { albumId, songId }) {
  const table = albumId ? 'list_albums' : 'list_songs';
  const column = albumId ? 'album_id' : 'song_id';
  const [rows] = await pool.execute(
    `SELECT x.*, EXISTS (SELECT 1 FROM ${table} m WHERE m.list_id = x.list_id AND m.${column} = ?) AS has_target
     FROM (${SELECT_LISTS} WHERE l.user_id = ?) x
     ORDER BY x.updated_at DESC, x.list_id DESC LIMIT 200`,
    [albumId || songId, userId],
  );
  return rows.map((row) => ({ ...toList(row), hasTarget: Boolean(row.has_target) }));
}

export async function createList(userId, { title, description, isPublic }) {
  const [result] = await pool.execute('INSERT INTO lists (user_id, title, description, is_public) VALUES (?, ?, ?, ?)', [
    userId,
    title,
    description || null,
    isPublic ? 1 : 0,
  ]);
  return result.insertId;
}

/** @returns true if a list owned by userId was updated */
export async function updateList(listId, userId, { title, description, isPublic }) {
  const [result] = await pool.execute(
    `UPDATE lists SET title = ?, description = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
     WHERE list_id = ? AND user_id = ?`,
    [title, description || null, isPublic ? 1 : 0, listId, userId],
  );
  return result.affectedRows > 0;
}

/** Items go with the list through ON DELETE CASCADE. */
export async function deleteList(listId, userId) {
  const [result] = await pool.execute('DELETE FROM lists WHERE list_id = ? AND user_id = ?', [listId, userId]);
  return result.affectedRows > 0;
}

const touch = (conn, listId) => conn.execute('UPDATE lists SET updated_at = CURRENT_TIMESTAMP WHERE list_id = ?', [listId]);

/**
 * Appends an album or song to the end of a list.
 * @returns 'added' | 'exists' | 'full'
 */
export function addItem(listId, { albumId, songId }, maxItems) {
  return withTransaction(async (conn) => {
    // Lock the list row so two adds at once can't pick the same position.
    await conn.execute('SELECT list_id FROM lists WHERE list_id = ? FOR UPDATE', [listId]);
    const [[stats]] = await conn.execute(
      `SELECT COUNT(*) AS total, COALESCE(MAX(position), 0) AS last_position FROM ${ITEMS} t WHERE t.list_id = ?`,
      [listId],
    );
    if (Number(stats.total) >= maxItems) return 'full';
    const table = albumId ? 'list_albums' : 'list_songs';
    const column = albumId ? 'album_id' : 'song_id';
    try {
      await conn.execute(`INSERT INTO ${table} (list_id, ${column}, position) VALUES (?, ?, ?)`, [
        listId,
        albumId || songId,
        Number(stats.last_position) + 1,
      ]);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return 'exists';
      throw err;
    }
    await touch(conn, listId);
    return 'added';
  });
}

/** @returns true if the item was in the list */
export function removeItem(listId, key) {
  const item = parseItemKey(key);
  if (!item) return false;
  return withTransaction(async (conn) => {
    const [result] = await conn.execute(`DELETE FROM ${item.table} WHERE list_id = ? AND ${item.column} = ?`, [
      listId,
      item.id,
    ]);
    if (result.affectedRows > 0) await touch(conn, listId);
    return result.affectedRows > 0;
  });
}

/** Rewrites positions 1..n in the given key order. Keys must be exactly the list's items. */
export function reorderItems(listId, keys) {
  return withTransaction(async (conn) => {
    for (const [index, key] of keys.entries()) {
      const item = parseItemKey(key);
      await conn.execute(`UPDATE ${item.table} SET position = ? WHERE list_id = ? AND ${item.column} = ?`, [
        index + 1,
        listId,
        item.id,
      ]);
    }
    await touch(conn, listId);
  });
}
