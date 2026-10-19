/**
 * Low-level HTTP client for the MusicBrainz web service and Cover Art Archive.
 *
 * - Every MusicBrainz request goes through one shared queue that starts at most
 *   one request per ~1.1 s, below MusicBrainz's 1 request/second limit for
 *   unauthenticated clients, no matter how many users are searching at once.
 * - Responses are cached in memory (search results briefly, lookups longer), and
 *   identical requests that are already in flight share one network call.
 * - Every request sends the TuneBoxd User-Agent that MusicBrainz requires.
 * - Failures become ServiceErrors with friendly messages (404, 503, ...).
 *
 * Only musicService.js should import this module.
 */
import { config } from '../config.js';
import { ServiceError } from '../utils/errors.js';

const MIN_INTERVAL_MS = 1100;
const MAX_WAITING = 20; // beyond this the queue would take 20+ s, so fail fast instead
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_CACHE_ENTRIES = 500;

export const UNAVAILABLE_MESSAGE = 'MusicBrainz is temporarily unavailable. Please try again in a moment.';
const BUSY_MESSAGE = 'Music search is busy right now. Please try again in a few seconds.';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------- Rate limiting ----------

let nextSlotAt = 0;
let waiting = 0;

/** Reserves the next free 1.1 s slot and waits for it. */
async function waitForSlot() {
  if (waiting >= MAX_WAITING) throw new ServiceError(503, BUSY_MESSAGE);
  const now = Date.now();
  const slot = Math.max(now, nextSlotAt);
  nextSlotAt = slot + MIN_INTERVAL_MS;
  if (slot > now) {
    waiting += 1;
    try {
      await sleep(slot - now);
    } finally {
      waiting -= 1;
    }
  }
}

// ---------- Cache ----------

const cache = new Map(); // key → { value, expiresAt }
const inFlight = new Map(); // key → Promise

function readCache(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

function writeCache(key, value, ttlMs) {
  if (cache.size >= MAX_CACHE_ENTRIES) cache.delete(cache.keys().next().value); // drop the oldest
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/** Returns a cached value, joins an identical in-flight request, or runs `load`. */
async function cached(key, ttlMs, load) {
  const hit = readCache(key);
  if (hit !== undefined) return hit;
  if (inFlight.has(key)) return inFlight.get(key);

  const promise = load()
    .then((value) => {
      writeCache(key, value, ttlMs);
      return value;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, promise);
  return promise;
}

// ---------- MusicBrainz ----------

async function fetchJson(url) {
  try {
    return await fetch(url, {
      headers: { 'User-Agent': config.musicBrainz.userAgent, Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    console.error(`[musicbrainz] Network error: ${err.name}`);
    throw new ServiceError(503, UNAVAILABLE_MESSAGE);
  }
}

/**
 * GET a MusicBrainz endpoint, e.g. mbRequest('release-group/<mbid>', { inc: 'genres' }).
 * @param {string} notFoundMessage  shown to the user on 404 (and on 400, which
 *   MusicBrainz returns for malformed IDs)
 */
export function mbRequest(path, params = {}, { ttlMs = 60 * 60 * 1000, notFoundMessage = 'Not found.' } = {}) {
  const query = new URLSearchParams({ ...params, fmt: 'json' });
  const url = `${config.musicBrainz.baseUrl}/${path}?${query}`;

  return cached(url, ttlMs, async () => {
    // MusicBrainz answers 503 when it (or we) are over the rate limit. Back off
    // and retry a couple of times before giving up.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await waitForSlot();
      const response = await fetchJson(url);
      if (response.ok) return response.json();
      if (response.status === 404 || response.status === 400) throw new ServiceError(404, notFoundMessage);
      if (response.status === 503 || response.status === 429) {
        nextSlotAt = Math.max(nextSlotAt, Date.now() + 2000 * (attempt + 1));
        continue;
      }
      console.error(`[musicbrainz] HTTP ${response.status} for ${path}`);
      throw new ServiceError(503, UNAVAILABLE_MESSAGE);
    }
    console.error(`[musicbrainz] Still rate limited after retries for ${path}`);
    throw new ServiceError(503, BUSY_MESSAGE);
  });
}

// ---------- Cover Art Archive ----------

const toHttps = (url) => (typeof url === 'string' ? url.replace(/^http:\/\//, 'https://') : null);

/**
 * Front cover for a release group, or null when there is none (or CAA is down).
 * CAA is a separate service without MusicBrainz's rate limit, but it is still
 * cached. Missing artwork is normal and never an error.
 * @returns {{ small: string, large: string } | null}
 */
export function fetchReleaseGroupCover(releaseGroupMbid) {
  const url = `${config.musicBrainz.coverArtBaseUrl}/release-group/${releaseGroupMbid}`;
  return cached(url, 24 * 60 * 60 * 1000, async () => {
    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': config.musicBrainz.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(6000),
      });
      if (!response.ok) return null; // 404 = no artwork uploaded
      const data = await response.json();
      const front = data.images?.find((image) => image.front) ?? data.images?.[0];
      if (!front) return null;
      return {
        small: toHttps(front.thumbnails?.['250'] || front.thumbnails?.small || front.image),
        large: toHttps(front.thumbnails?.['500'] || front.thumbnails?.large || front.image),
      };
    } catch {
      return null;
    }
  });
}

/** Direct image URL for search results; the browser falls back to a placeholder on 404. */
export function releaseGroupCoverUrl(releaseGroupMbid, size = 250) {
  return `${config.musicBrainz.coverArtBaseUrl}/release-group/${releaseGroupMbid}/front-${size}`;
}
