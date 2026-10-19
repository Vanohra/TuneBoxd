/**
 * Music catalog: search and details from MusicBrainz, plus "find or create" of
 * the matching local rows in MySQL when a user reviews or logs something.
 *
 * TuneBoxd ↔ MusicBrainz mapping (see docs/sprint3-music-features.md):
 *   artist → MusicBrainz artist         (artists.external_id = artist MBID)
 *   album  → MusicBrainz release group  (albums.external_id  = release-group MBID)
 *   song   → MusicBrainz recording      (songs.external_id   = recording MBID)
 * All rows use external_source = 'musicbrainz'. A release group covers every
 * edition of an album (CD, vinyl, remaster...), so reviews of "the same album"
 * never split across editions. The tracklist shown comes from one representative
 * release in the group (the earliest official one).
 */
import * as musicRepository from '../repositories/musicRepository.js';
import { ServiceError } from '../utils/errors.js';
import { isMbid } from '../utils/validation.js';
import { fetchReleaseGroupCover, mbRequest, releaseGroupCoverUrl } from './musicBrainzClient.js';

const SEARCH_TTL = 10 * 60 * 1000;
const LOOKUP_TTL = 6 * 60 * 60 * 1000;
const SEARCH_LIMIT = 20;
const QUERY_MAX_LENGTH = 100;

export const SEARCH_TYPES = ['album', 'artist', 'song'];

// ---------- Mapping helpers (pure; exported for tests) ----------

/** "Jay-Z & Linkin Park" from an artist-credit array. */
export function creditName(credit = []) {
  return credit.map((part) => `${part.name ?? part.artist?.name ?? ''}${part.joinphrase ?? ''}`).join('') || 'Unknown artist';
}

/** [{ mbid, name }] for every credited artist. */
export function creditArtists(credit = []) {
  return credit.filter((part) => part.artist?.id).map((part) => ({ mbid: part.artist.id, name: part.artist.name }));
}

const msToSeconds = (ms) => (Number.isFinite(ms) && ms > 0 ? Math.round(ms / 1000) : null);

/** Top genres by vote count; falls back to tags when nobody has voted on genres. */
export function topGenres(entity, limit = 5) {
  const list = entity?.genres?.length ? entity.genres : entity?.tags ?? [];
  return [...list]
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, limit)
    .map((genre) => genre.name);
}

/** MusicBrainz dates can be "2007", "2007-10" or "2007-10-10". MySQL DATE needs all three parts. */
export function toSqlDate(mbDate) {
  return /^\d{4}-\d{2}-\d{2}$/.test(mbDate ?? '') ? mbDate : null;
}

/**
 * Picks the release whose tracklist represents the album: official releases
 * first, then the earliest dated one.
 */
export function pickRepresentativeRelease(releases = []) {
  // Partial dates ("2007") are padded to the end of their period so an exact
  // "2007-10-10" release wins over a vaguely dated one from the same year.
  const sortableDate = (date) => ({ 4: `${date}-12-31`, 7: `${date}-31`, 10: date })[date?.length] ?? '9999-12-31';
  const rank = (release) => [release.status === 'Official' ? 0 : 1, sortableDate(release.date)];
  return [...releases].sort((a, b) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < ra.length; i += 1) {
      if (ra[i] < rb[i]) return -1;
      if (ra[i] > rb[i]) return 1;
    }
    return 0;
  })[0];
}

export function toAlbumSummary(releaseGroup) {
  return {
    mbid: releaseGroup.id,
    title: releaseGroup.title,
    artistName: creditName(releaseGroup['artist-credit']),
    artists: creditArtists(releaseGroup['artist-credit']),
    releaseDate: releaseGroup['first-release-date'] || null,
    primaryType: releaseGroup['primary-type'] || null,
    secondaryTypes: releaseGroup['secondary-types'] ?? [],
    coverUrl: releaseGroupCoverUrl(releaseGroup.id),
  };
}

export function toArtistSummary(artist) {
  return {
    mbid: artist.id,
    name: artist.name,
    type: artist.type || null,
    country: artist.country || null,
    area: artist.area?.name || null,
    disambiguation: artist.disambiguation || '',
    lifeSpan: { begin: artist['life-span']?.begin || null, end: artist['life-span']?.end || null },
  };
}

/** The album a recording "belongs to": prefer an official studio album release. */
export function pickRecordingAlbum(recording) {
  const releases = recording.releases ?? [];
  const isAlbum = (release) => release['release-group']?.['primary-type'] === 'Album';
  const isStudio = (release) => !(release['release-group']?.['secondary-types'] ?? []).length;
  const albums = releases.filter(isAlbum);
  const studioAlbums = albums.filter(isStudio);
  const release = pickRepresentativeRelease(studioAlbums.length ? studioAlbums : albums.length ? albums : releases);
  const group = release?.['release-group'];
  if (!group?.id) return null;
  return {
    mbid: group.id,
    title: group.title || release.title,
    releaseDate: group['first-release-date'] || release.date || null,
    coverUrl: releaseGroupCoverUrl(group.id),
    artistCredit: group['artist-credit'] ?? release['artist-credit'] ?? null,
  };
}

export function toSongSummary(recording) {
  const album = pickRecordingAlbum(recording);
  return {
    mbid: recording.id,
    title: recording.title,
    artistName: creditName(recording['artist-credit']),
    artists: creditArtists(recording['artist-credit']),
    durationSeconds: msToSeconds(recording.length),
    releaseDate: recording['first-release-date'] || null,
    album: album && { mbid: album.mbid, title: album.title, releaseDate: album.releaseDate, coverUrl: album.coverUrl },
    coverUrl: album?.coverUrl ?? null,
  };
}

function requireMbid(mbid, label) {
  if (!isMbid(mbid)) throw new ServiceError(400, `That isn’t a valid ${label} ID.`);
  return mbid.toLowerCase();
}

// ---------- Search ----------

const SEARCH_ENTITIES = { album: 'release-group', artist: 'artist', song: 'recording' };
const RESULT_KEYS = { album: 'release-groups', artist: 'artists', song: 'recordings' };
const MAPPERS = { album: toAlbumSummary, artist: toArtistSummary, song: toSongSummary };

export async function search(rawQuery, rawType = 'album', rawPage = 1) {
  const query = String(rawQuery ?? '').trim().replace(/\s+/g, ' ');
  const type = SEARCH_TYPES.includes(rawType) ? rawType : null;
  const page = Math.max(1, Math.min(Number.parseInt(rawPage, 10) || 1, 20));
  if (!type) throw new ServiceError(400, 'Search type must be album, artist or song.');
  if (!query) throw new ServiceError(400, 'Please enter something to search for.');
  if (query.length > QUERY_MAX_LENGTH) throw new ServiceError(400, `Searches must be ${QUERY_MAX_LENGTH} characters or fewer.`);

  // dismax=true makes MusicBrainz treat the query as plain words (no Lucene
  // syntax), matched against titles AND artist names, e.g. "ok computer radiohead".
  const data = await mbRequest(
    SEARCH_ENTITIES[type],
    { query, dismax: 'true', limit: SEARCH_LIMIT, offset: (page - 1) * SEARCH_LIMIT },
    { ttlMs: SEARCH_TTL },
  );
  const results = (data[RESULT_KEYS[type]] ?? []).map(MAPPERS[type]);
  return { query, type, page, total: data.count ?? results.length, pageSize: SEARCH_LIMIT, results };
}

// ---------- Details ----------

export async function getAlbum(rawMbid) {
  const mbid = requireMbid(rawMbid, 'album');
  const group = await mbRequest(
    `release-group/${mbid}`,
    { inc: 'artist-credits releases genres tags' },
    { ttlMs: LOOKUP_TTL, notFoundMessage: 'We couldn’t find that album.' },
  );

  const release = pickRepresentativeRelease(group.releases);
  const [releaseDetail, cover] = await Promise.all([
    release
      ? mbRequest(`release/${release.id}`, { inc: 'recordings artist-credits' }, { ttlMs: LOOKUP_TTL }).catch((err) => {
          // The album itself loaded; a missing tracklist shouldn't break the page.
          console.error(`[musicbrainz] Tracklist unavailable for release ${release.id}: ${err.message}`);
          return null;
        })
      : null,
    fetchReleaseGroupCover(mbid),
  ]);

  const media = releaseDetail?.media ?? [];
  const tracks = media.flatMap((medium) =>
    (medium.tracks ?? []).map((track) => ({
      discNumber: medium.position ?? 1,
      position: track.position,
      number: track.number ?? String(track.position),
      title: track.title ?? track.recording?.title ?? 'Untitled',
      durationSeconds: msToSeconds(track.length ?? track.recording?.length),
      recordingMbid: track.recording?.id ?? null,
      artistName: track['artist-credit'] ? creditName(track['artist-credit']) : null,
    })),
  );
  const totalSeconds = tracks.reduce((sum, track) => sum + (track.durationSeconds ?? 0), 0);

  return {
    ...toAlbumSummary(group),
    coverUrl: cover?.large ?? null,
    coverThumbUrl: cover?.small ?? null,
    genres: topGenres(group),
    disambiguation: group.disambiguation || '',
    editionCount: group.releases?.length ?? 0,
    tracklistSource: release
      ? { mbid: release.id, title: release.title, date: release.date || null, country: release.country || null }
      : null,
    discCount: media.length,
    tracks,
    totalSeconds: totalSeconds || null,
  };
}

export async function getArtist(rawMbid) {
  const mbid = requireMbid(rawMbid, 'artist');
  const artist = await mbRequest(
    `artist/${mbid}`,
    { inc: 'genres tags' },
    { ttlMs: LOOKUP_TTL, notFoundMessage: 'We couldn’t find that artist.' },
  );
  // Browse (not search) the artist's albums and EPs, up to 100.
  const browse = await mbRequest(
    'release-group',
    { artist: mbid, type: 'album|ep', limit: 100 },
    { ttlMs: LOOKUP_TTL },
  ).catch(() => ({ 'release-groups': [] }));

  const albums = (browse['release-groups'] ?? [])
    .map((group) => ({ ...toAlbumSummary(group), artistName: group['artist-credit'] ? creditName(group['artist-credit']) : artist.name }))
    .sort((a, b) => {
      // Studio albums first, then EPs and compilations/live; newest first within each.
      const weight = (album) => (album.secondaryTypes.length ? 2 : album.primaryType === 'Album' ? 0 : 1);
      return weight(a) - weight(b) || String(b.releaseDate ?? '').localeCompare(String(a.releaseDate ?? ''));
    });

  return { ...toArtistSummary(artist), genres: topGenres(artist), albums };
}

export async function getSong(rawMbid) {
  const mbid = requireMbid(rawMbid, 'song');
  const recording = await mbRequest(
    `recording/${mbid}`,
    { inc: 'artist-credits releases release-groups genres tags' },
    { ttlMs: LOOKUP_TTL, notFoundMessage: 'We couldn’t find that song.' },
  );
  return { ...toSongSummary(recording), genres: topGenres(recording) };
}

// ---------- Local MySQL records ----------

/**
 * Makes sure the album exists in MySQL (with its primary artist) and returns its
 * local album_id. Reuses the existing row when the album was saved before, so
 * many users reviewing one album never create duplicates (UNIQUE external_id).
 *
 * The MusicBrainz lookup also proves the MBID is real. If MusicBrainz is down
 * but the album is already in MySQL, the existing row is used.
 */
export async function ensureLocalAlbum(rawMbid) {
  const mbid = requireMbid(rawMbid, 'album');
  let album;
  try {
    album = await getAlbum(mbid);
  } catch (err) {
    const existing = err.status === 503 ? await musicRepository.findAlbumByMbid(mbid) : null;
    if (existing) return existing.albumId;
    throw err;
  }
  const primary = album.artists[0] ?? { mbid: null, name: album.artistName };
  return musicRepository.upsertAlbumWithArtist({
    artist: primary,
    album: { mbid, title: album.title, releaseDate: toSqlDate(album.releaseDate), coverUrl: album.coverThumbUrl },
  });
}

/** Same as ensureLocalAlbum, for songs (MusicBrainz recordings). Also links the song's album when known. */
export async function ensureLocalSong(rawMbid) {
  const mbid = requireMbid(rawMbid, 'song');
  let song;
  let recordingAlbum;
  try {
    const recording = await mbRequest(
      `recording/${mbid}`,
      { inc: 'artist-credits releases release-groups genres tags' },
      { ttlMs: LOOKUP_TTL, notFoundMessage: 'We couldn’t find that song.' },
    );
    song = toSongSummary(recording);
    recordingAlbum = pickRecordingAlbum(recording);
  } catch (err) {
    const existing = err.status === 503 ? await musicRepository.findSongByMbid(mbid) : null;
    if (existing) return existing.songId;
    throw err;
  }

  const primary = song.artists[0] ?? { mbid: null, name: song.artistName };
  const albumArtists = creditArtists(recordingAlbum?.artistCredit ?? []);
  return musicRepository.upsertSongWithArtist({
    artist: primary,
    song: { mbid, title: song.title, durationSeconds: song.durationSeconds },
    album: recordingAlbum && {
      mbid: recordingAlbum.mbid,
      title: recordingAlbum.title,
      releaseDate: toSqlDate(recordingAlbum.releaseDate),
      coverUrl: recordingAlbum.coverUrl,
      artist: albumArtists[0] ?? primary,
    },
  });
}

/** { albumId } or { songId } for a review/diary target, creating local rows as needed. */
export async function ensureLocalTarget(targetType, mbid) {
  if (targetType === 'album') return { albumId: await ensureLocalAlbum(mbid), songId: null };
  if (targetType === 'song') return { albumId: null, songId: await ensureLocalSong(mbid) };
  throw new ServiceError(400, 'Target type must be album or song.');
}

/** Local IDs for an MBID without contacting MusicBrainz (null when nothing was saved yet). */
export async function findLocalTarget(targetType, rawMbid) {
  const mbid = requireMbid(rawMbid, targetType === 'song' ? 'song' : 'album');
  if (targetType === 'song') {
    const song = await musicRepository.findSongByMbid(mbid);
    return song ? { albumId: null, songId: song.songId } : null;
  }
  const album = await musicRepository.findAlbumByMbid(mbid);
  return album ? { albumId: album.albumId, songId: null } : null;
}
