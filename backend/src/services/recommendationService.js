/**
 * Personalized music recommendations (feature #13).
 *
 * Step 1 (always): pick albums from TuneBoxd's catalog the user hasn't
 * rated, logged or listed yet, from four signals, strongest first:
 *   1. taste neighbours: members who loved the same albums loved these
 *   2. people you follow rated these 4+ stars
 *   3. more from artists you log and rate highly
 *   4. the community's highest-rated albums (fallback for new members)
 * Step 2 (when ANTHROPIC_API_KEY is set): Claude rewrites each rule-based
 * reason as one friendly, specific sentence. If that fails the rule-based
 * reasons are kept.
 *
 * The result is saved in `recommendations`, so it isn't recomputed on every
 * visit; "Refresh" regenerates it.
 */
import * as recommendationRepository from '../repositories/recommendationRepository.js';
import * as statsRepository from '../repositories/statsRepository.js';
import { formatStars } from '../utils/format.js';
import { generateJson, isAiConfigured } from './aiClient.js';

const RECOMMENDATION_COUNT = 8;

const plural = (count, word) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Ordered, de-duplicated candidates: [{ albumId, reason }]. */
async function pickCandidates(userId) {
  const favouriteArtists = await recommendationRepository.findFavouriteArtists(userId);
  const artistNames = new Map(favouriteArtists.map((artist) => [artist.artistId, artist.name]));
  const [neighbours, following, byArtist, popular] = await Promise.all([
    recommendationRepository.findNeighbourPicks(userId),
    recommendationRepository.findFollowingPicks(userId),
    recommendationRepository.findArtistPicks(userId, [...artistNames.keys()]),
    recommendationRepository.findPopularPicks(userId),
  ]);

  const picks = new Map();
  const add = (albumId, reason) => {
    if (!picks.has(albumId) && picks.size < RECOMMENDATION_COUNT) picks.set(albumId, reason);
  };
  for (const pick of neighbours) {
    add(pick.albumId, `${plural(pick.fans, 'member')} who loved the same albums as you rated this ${formatStars(pick.average)} on average.`);
  }
  for (const pick of following) {
    const who = pick.fans === 1 ? `@${pick.username}, who you follow,` : `${pick.fans} people you follow`;
    add(pick.albumId, `${who} rated this ${formatStars(pick.average)}.`);
  }
  for (const pick of byArtist) {
    add(pick.albumId, `More from ${artistNames.get(pick.artistId)}, one of the artists you listen to most.`);
  }
  for (const pick of popular) {
    add(pick.albumId, `One of TuneBoxd’s highest-rated albums: ${formatStars(pick.average)} from ${plural(pick.ratings, 'rating')}.`);
  }
  return [...picks].map(([albumId, reason]) => ({ albumId, reason }));
}

const REASONS_SCHEMA = {
  type: 'object',
  properties: {
    reasons: {
      type: 'array',
      items: {
        type: 'object',
        properties: { id: { type: 'integer' }, reason: { type: 'string' } },
        required: ['id', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['reasons'],
  additionalProperties: false,
};

/** Claude rewrites the reasons using the user's taste profile. Returns null on any failure. */
async function writeReasonsWithAi(userId, candidates, targets) {
  const [topArtists, topAlbums] = await Promise.all([
    statsRepository.getTopArtists(userId, undefined, 8),
    statsRepository.getTopAlbums(userId, undefined, 5),
  ]);
  const data = {
    listener: {
      mostLoggedArtists: topArtists.map((artist) => artist.name),
      mostLoggedAlbums: topAlbums.map((album) => `${album.title} by ${album.artistName}`),
    },
    recommendations: candidates.map((candidate) => ({
      id: candidate.albumId,
      album: targets.get(candidate.albumId)?.title,
      artist: targets.get(candidate.albumId)?.artistName,
      whyChosen: candidate.reason,
    })),
  };
  const result = await generateJson({
    system:
      'You write the short explanations shown next to album recommendations on TuneBoxd, a music diary and review site. ' +
      'For each recommendation write one sentence (under 30 words) telling the listener why they might like it. ' +
      'Base it on whyChosen and on the listener’s history; you may mention the album’s style or era if you are confident. ' +
      'Never invent ratings, numbers or usernames that are not in the data. Address the listener as "you".',
    prompt: `Data:\n${JSON.stringify(data, null, 2)}\n\nReturn one reason for every recommendation id.`,
    schema: REASONS_SCHEMA,
  });
  if (!result) return null;
  const byId = new Map(result.reasons.map((item) => [item.id, item.reason.trim()]));
  return candidates.map((candidate) => ({ ...candidate, reason: byId.get(candidate.albumId) || candidate.reason }));
}

/** Recomputes and saves the user's recommendations. */
export async function refreshRecommendations(userId) {
  let candidates = await pickCandidates(userId);
  const targets = await recommendationRepository.findAlbumTargets(candidates.map((candidate) => candidate.albumId));
  candidates = candidates.filter((candidate) => targets.has(candidate.albumId));
  if (candidates.length > 0 && isAiConfigured()) {
    candidates = (await writeReasonsWithAi(userId, candidates, targets)) ?? candidates;
  }
  // reason is TEXT, but keep it to a sensible length whatever the source.
  await recommendationRepository.replaceRecommendations(
    userId,
    candidates.map((candidate) => ({ ...candidate, reason: candidate.reason.slice(0, 500) })),
  );
  return getSaved(userId);
}

async function getSaved(userId) {
  const recommendations = await recommendationRepository.listRecommendations(userId);
  return {
    recommendations,
    generatedAt: recommendations[0]?.generatedAt ?? null,
    aiEnabled: isAiConfigured(),
  };
}

/** Saved recommendations, generated on first visit. */
export async function getRecommendations(userId) {
  const saved = await getSaved(userId);
  return saved.recommendations.length > 0 ? saved : refreshRecommendations(userId);
}
