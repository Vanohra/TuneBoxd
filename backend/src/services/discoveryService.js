/**
 * "Ask TuneBoxd": natural-language music discovery (AI feature).
 *
 * 1. The user describes what they want ("moody 2000s indie for a rainy night").
 * 2. Google Gemini interprets it, using the user's most-logged artists as
 *    context, and suggests albums with a reason for each.
 * 3. Every suggestion is looked up on MusicBrainz. Only albums that really
 *    exist are returned, with their MBID and cover, so a made-up album can
 *    never reach the page.
 *
 * Needs GEMINI_API_KEY: there is no rule-based version of understanding free
 * text, so without a key the endpoint answers 503 and the page says so.
 */
import * as recommendationRepository from '../repositories/recommendationRepository.js';
import * as statsRepository from '../repositories/statsRepository.js';
import { ServiceError } from '../utils/errors.js';
import { cleanText } from '../utils/validation.js';
import { generateJson, isAiConfigured } from './aiClient.js';
import { mbRequest } from './musicBrainzClient.js';
import { creditName, toAlbumSummary } from './musicService.js';

export const PROMPT_MIN_LENGTH = 3;
export const PROMPT_MAX_LENGTH = 300;
const SUGGESTION_COUNT = 6;
const LOOKUP_TTL = 6 * 60 * 60 * 1000;

// Free-tier quota protection: each member gets a few discovery requests per hour.
const HOURLY_LIMIT = 15;
const recentRequests = new Map(); // userId -> [timestamps]

function checkRateLimit(userId, now = Date.now()) {
  const hourAgo = now - 60 * 60 * 1000;
  const times = (recentRequests.get(userId) ?? []).filter((time) => time > hourAgo);
  if (times.length >= HOURLY_LIMIT) {
    throw new ServiceError(429, 'You’ve asked a lot this hour. Please try again a little later.');
  }
  times.push(now);
  recentRequests.set(userId, times);
}

/** Lowercase, no accents, no punctuation, "the"/"&" normalized: for loose title/artist matching. */
export function normalizeName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^the /, '')
    .trim();
}

/** True when the two names match, or one contains the other ("Beyoncé" / "Beyonce Knowles"). */
export function namesMatch(a, b) {
  const x = normalizeName(a);
  const y = normalizeName(b);
  return Boolean(x && y && (x === y || x.includes(y) || y.includes(x)));
}

/** Escapes a value for a quoted MusicBrainz (Lucene) search term. */
export function luceneQuote(value) {
  return `"${String(value).replace(/[\\"]/g, '\\$&')}"`;
}

/**
 * Picks the MusicBrainz release group that is really the suggested album:
 * artist must match, title must match; studio albums and EPs beat compilations.
 */
export function pickReleaseGroup(groups, { title, artist }) {
  const matches = groups.filter(
    (group) => namesMatch(group.title, title) && namesMatch(creditName(group['artist-credit']), artist),
  );
  const rank = (group) =>
    (group['primary-type'] === 'Album' ? 0 : group['primary-type'] === 'EP' ? 1 : 2) +
    ((group['secondary-types'] ?? []).length ? 2 : 0);
  return matches.sort((a, b) => rank(a) - rank(b))[0] ?? null;
}

async function verifyOnMusicBrainz(suggestion) {
  try {
    const data = await mbRequest(
      'release-group',
      { query: `releasegroup:${luceneQuote(suggestion.title)} AND artist:${luceneQuote(suggestion.artist)}`, limit: 8 },
      { ttlMs: LOOKUP_TTL },
    );
    const group = pickReleaseGroup(data['release-groups'] ?? [], suggestion);
    return group ? toAlbumSummary(group) : null;
  } catch {
    return null; // MusicBrainz busy or down: treat as unverified rather than failing everything
  }
}

const SUGGESTIONS_SCHEMA = {
  type: 'object',
  properties: {
    interpretation: { type: 'string' },
    albums: {
      type: 'array',
      maxItems: SUGGESTION_COUNT + 2,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          artist: { type: 'string' },
          year: { type: ['integer', 'null'] },
          reason: { type: 'string' },
        },
        required: ['title', 'artist', 'reason'],
      },
    },
  },
  required: ['interpretation', 'albums'],
};

export function validatePrompt(raw) {
  const prompt = cleanText(raw).replace(/\s+/g, ' ');
  if (prompt.length < PROMPT_MIN_LENGTH) throw new ServiceError(400, 'Tell us a little more about what you want to hear.');
  if (prompt.length > PROMPT_MAX_LENGTH) throw new ServiceError(400, `Please keep it under ${PROMPT_MAX_LENGTH} characters.`);
  return prompt;
}

/** body: { prompt } → { interpretation, results: [album + reason], suggestedCount } */
export async function discover(userId, input = {}) {
  const prompt = validatePrompt(input.prompt);
  if (!isAiConfigured()) {
    throw new ServiceError(503, 'AI discovery isn’t switched on for this site yet.');
  }
  checkRateLimit(userId);

  const topArtists = await statsRepository.getTopArtists(userId, undefined, 8);
  const result = await generateJson({
    system:
      'You are TuneBoxd’s music discovery assistant. A listener describes what they want to hear. ' +
      `Suggest ${SUGGESTION_COUNT} real, released albums that fit the request: varied artists, a mix of well-known and lesser-known picks. ` +
      'Use the exact official album title and main artist name as listed on MusicBrainz. Never invent albums. ' +
      'If the request is not about music, suggest albums that fit its mood anyway. ' +
      'interpretation: one short sentence restating what they asked for. reason: one sentence (under 30 words) on why that album fits, addressed to "you". ' +
      'You may use the listener’s most-logged artists as taste context, but do not just repeat those artists.',
    prompt: JSON.stringify({ request: prompt, listenersMostLoggedArtists: topArtists.map((artist) => artist.name) }),
    schema: SUGGESTIONS_SCHEMA,
  });
  if (!result || !Array.isArray(result.albums)) {
    throw new ServiceError(503, 'The AI couldn’t answer right now. Please try again in a moment.');
  }

  const suggestions = result.albums
    .filter((album) => album?.title && album?.artist)
    .slice(0, SUGGESTION_COUNT)
    .map((album) => ({ title: String(album.title).slice(0, 200), artist: String(album.artist).slice(0, 200), reason: String(album.reason ?? '').slice(0, 300) }));

  // Sequential on purpose: MusicBrainz allows about one request per second.
  const results = [];
  const seen = new Set();
  for (const suggestion of suggestions) {
    const album = await verifyOnMusicBrainz(suggestion);
    if (album && !seen.has(album.mbid)) {
      seen.add(album.mbid);
      results.push({ ...album, reason: suggestion.reason });
    }
  }

  const known = await recommendationRepository.findKnownAlbumMbids(userId, results.map((album) => album.mbid));
  return {
    prompt,
    interpretation: String(result.interpretation ?? '').slice(0, 300),
    results: results.map((album) => ({ ...album, alreadyKnown: known.has(album.mbid) })),
    suggestedCount: suggestions.length,
  };
}
