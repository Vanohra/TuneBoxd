import { apiRequest } from './client.js';

// All music metadata goes through the TuneBoxd backend, which talks to
// MusicBrainz (rate-limited and cached). The browser never calls MusicBrainz.

/** type: 'album' | 'artist' | 'song' */
export function searchMusic(query, type = 'album', page = 1) {
  const params = new URLSearchParams({ query, type, page: String(page) });
  return apiRequest(`/music/search?${params}`);
}

export async function fetchAlbum(mbid) {
  const { album } = await apiRequest(`/music/albums/${encodeURIComponent(mbid)}`);
  return album;
}

export async function fetchArtist(mbid) {
  const { artist } = await apiRequest(`/music/artists/${encodeURIComponent(mbid)}`);
  return artist;
}

export async function fetchSong(mbid) {
  const { song } = await apiRequest(`/music/songs/${encodeURIComponent(mbid)}`);
  return song;
}

/** { reviews, stats: { averageRating, ratingCount, reviewCount }, viewerReviewId } from MySQL. */
export function fetchTargetReviews(targetType, mbid) {
  const collection = targetType === 'song' ? 'songs' : 'albums';
  return apiRequest(`/music/${collection}/${encodeURIComponent(mbid)}/reviews`);
}
