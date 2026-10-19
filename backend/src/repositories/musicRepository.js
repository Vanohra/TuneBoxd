/**
 * Music repository: the ONLY module that reads or writes the `artists`,
 * `albums` and `songs` tables.
 *
 * Rows from MusicBrainz use external_source = 'musicbrainz' and external_id =
 * the MusicBrainz ID (MBID). The UNIQUE (external_source, external_id) keys
 * make every upsert idempotent: two users reviewing the same album at the same
 * moment both end up with the same album_id, never a duplicate row.
 *
 * `INSERT ... ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)` makes MySQL
 * report the existing row's ID as insertId, so one statement gives "find or
 * create" without a race between a SELECT and an INSERT.
 */
import { pool, withTransaction } from '../db.js';
import { ServiceError } from '../utils/errors.js';

export const SOURCE = 'musicbrainz';

function requireArtistMbid(artist) {
  if (!artist?.mbid || !artist.name) {
    throw new ServiceError(502, 'MusicBrainz returned incomplete artist information for this item. Please try again later.');
  }
}

async function upsertArtist(conn, { mbid, name }) {
  requireArtistMbid({ mbid, name });
  const [result] = await conn.execute(
    `INSERT INTO artists (external_source, external_id, name) VALUES (?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE artist_id = LAST_INSERT_ID(artist_id), name = new.name`,
    [SOURCE, mbid, name.slice(0, 255)],
  );
  return result.insertId;
}

async function upsertAlbum(conn, artistId, { mbid, title, releaseDate, coverUrl }) {
  // Existing cover/date values are kept when MusicBrainz didn't send one this time.
  const [result] = await conn.execute(
    `INSERT INTO albums (external_source, external_id, artist_id, title, release_date, cover_url)
     VALUES (?, ?, ?, ?, ?, ?) AS new
     ON DUPLICATE KEY UPDATE album_id = LAST_INSERT_ID(albums.album_id),
       artist_id = new.artist_id, title = new.title,
       release_date = COALESCE(new.release_date, albums.release_date),
       cover_url = COALESCE(new.cover_url, albums.cover_url)`,
    [SOURCE, mbid, artistId, title.slice(0, 255), releaseDate ?? null, coverUrl?.slice(0, 500) ?? null],
  );
  return result.insertId;
}


/** @returns local album_id */
export function upsertAlbumWithArtist({ artist, album }) {
  return withTransaction(async (conn) => {
    const artistId = await upsertArtist(conn, artist);
    return upsertAlbum(conn, artistId, album);
  });
}

/** @returns local song_id. `album` is optional (singles without a known album). */
export function upsertSongWithArtist({ artist, song, album }) {
  return withTransaction(async (conn) => {
    const artistId = await upsertArtist(conn, artist);
    let albumId = null;
    if (album?.mbid && album.artist?.mbid) {
      const albumArtistId = album.artist.mbid === artist.mbid ? artistId : await upsertArtist(conn, album.artist);
      albumId = await upsertAlbum(conn, albumArtistId, album);
    }
    const [result] = await conn.execute(
      `INSERT INTO songs (external_source, external_id, album_id, artist_id, title, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?) AS new
       ON DUPLICATE KEY UPDATE song_id = LAST_INSERT_ID(songs.song_id),
         album_id = COALESCE(new.album_id, songs.album_id), artist_id = new.artist_id,
         title = new.title, duration_seconds = COALESCE(new.duration_seconds, songs.duration_seconds)`,
      [SOURCE, song.mbid, albumId, artistId, song.title.slice(0, 255), song.durationSeconds ?? null],
    );
    return result.insertId;
  });
}

export async function findAlbumByMbid(mbid) {
  const [rows] = await pool.execute(
    'SELECT album_id FROM albums WHERE external_source = ? AND external_id = ? LIMIT 1',
    [SOURCE, mbid],
  );
  return rows[0] ? { albumId: rows[0].album_id } : null;
}

export async function findSongByMbid(mbid) {
  const [rows] = await pool.execute(
    'SELECT song_id FROM songs WHERE external_source = ? AND external_id = ? LIMIT 1',
    [SOURCE, mbid],
  );
  return rows[0] ? { songId: rows[0].song_id } : null;
}

/**
 * SQL fragments shared by the review and diary repositories to describe what
 * an entry is about. Expects the main table aliased as `t` with album_id/song_id.
 */
export const TARGET_COLUMNS = `
  al.external_id AS album_mbid, al.title AS album_title, al.cover_url AS album_cover_url,
  DATE_FORMAT(al.release_date, '%Y-%m-%d') AS album_release_date,
  ala.external_id AS album_artist_mbid, ala.name AS album_artist_name,
  s.external_id AS song_mbid, s.title AS song_title, s.duration_seconds AS song_duration_seconds,
  sa.external_id AS song_artist_mbid, sa.name AS song_artist_name,
  sal.external_id AS song_album_mbid, sal.title AS song_album_title, sal.cover_url AS song_album_cover_url`;

export const TARGET_JOINS = `
  LEFT JOIN albums al ON al.album_id = t.album_id
  LEFT JOIN artists ala ON ala.artist_id = al.artist_id
  LEFT JOIN songs s ON s.song_id = t.song_id
  LEFT JOIN artists sa ON sa.artist_id = s.artist_id
  LEFT JOIN albums sal ON sal.album_id = s.album_id`;

/** Converts the TARGET_COLUMNS of a row into the `target` object the frontend uses. */
export function toTarget(row) {
  if (row.album_mbid) {
    return {
      type: 'album',
      mbid: row.album_mbid,
      title: row.album_title,
      artistName: row.album_artist_name,
      artistMbid: row.album_artist_mbid,
      coverUrl: row.album_cover_url ?? null,
      releaseDate: row.album_release_date ?? null,
    };
  }
  return {
    type: 'song',
    mbid: row.song_mbid,
    title: row.song_title,
    artistName: row.song_artist_name,
    artistMbid: row.song_artist_mbid,
    durationSeconds: row.song_duration_seconds ?? null,
    coverUrl: row.song_album_cover_url ?? null,
    album: row.song_album_mbid ? { mbid: row.song_album_mbid, title: row.song_album_title } : null,
  };
}
