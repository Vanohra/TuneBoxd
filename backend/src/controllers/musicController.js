import * as musicService from '../services/musicService.js';
import * as reviewService from '../services/reviewService.js';

const viewerIdOf = (req) => req.session?.userId ?? null;

// GET /api/music/search?query=...&type=album|artist|song&page=1
export async function search(req, res) {
  res.json(await musicService.search(req.query.query ?? req.query.q, req.query.type ?? 'album', req.query.page));
}

// GET /api/music/albums/:mbid
export async function getAlbum(req, res) {
  res.json({ album: await musicService.getAlbum(req.params.mbid) });
}

// GET /api/music/artists/:mbid
export async function getArtist(req, res) {
  res.json({ artist: await musicService.getArtist(req.params.mbid) });
}

// GET /api/music/songs/:mbid
export async function getSong(req, res) {
  res.json({ song: await musicService.getSong(req.params.mbid) });
}

// GET /api/music/albums/:mbid/reviews (reviews come from MySQL, not MusicBrainz)
export async function getAlbumReviews(req, res) {
  res.json(await reviewService.listForTarget('album', req.params.mbid, viewerIdOf(req)));
}

// GET /api/music/songs/:mbid/reviews
export async function getSongReviews(req, res) {
  res.json(await reviewService.listForTarget('song', req.params.mbid, viewerIdOf(req)));
}
