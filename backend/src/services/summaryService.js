/**
 * Review and listening summaries (feature #14).
 *
 * The user picks a period (up to a year). TuneBoxd gathers what they logged,
 * rated and reviewed in it and writes a short summary: by Gemini when
 * GEMINI_API_KEY is set, otherwise from a template. Summaries are saved in
 * `listening_summaries` and are private to their owner.
 */
import * as recommendationRepository from '../repositories/recommendationRepository.js';
import * as statsRepository from '../repositories/statsRepository.js';
import { ServiceError } from '../utils/errors.js';
import { formatStars, formatYmd, joinWords } from '../utils/format.js';
import { parseId, validateSummaryPeriod } from '../utils/validation.js';
import { generateJson, isAiConfigured } from './aiClient.js';

const REVIEW_EXCERPT_LENGTH = 300;

async function gatherPeriod(userId, period) {
  const [totals, topArtists, topAlbums, ratings, reviews, weekdays] = await Promise.all([
    statsRepository.getTotals(userId, period),
    statsRepository.getTopArtists(userId, period, 5),
    statsRepository.getTopAlbums(userId, period, 5),
    statsRepository.getRatingStats(userId, period),
    statsRepository.getReviewsInPeriod(userId, period, 10),
    statsRepository.getWeekdayCounts(userId, period),
  ]);
  return { totals, topArtists, topAlbums, ratings, reviews, weekdays };
}

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** Template summary from the numbers alone. Exported for tests. */
export function writeRuleSummary({ periodStart, periodEnd }, data) {
  const { totals, topArtists, topAlbums, ratings, reviews, weekdays } = data;
  const parts = [];
  const range = `${formatYmd(periodStart)} to ${formatYmd(periodEnd)}`;

  if (totals.entries > 0) {
    parts.push(
      `From ${range} you logged ${totals.entries} listen${totals.entries === 1 ? '' : 's'} across ${totals.activeDays} day${totals.activeDays === 1 ? '' : 's'}: ` +
        `${totals.distinctAlbums} distinct album${totals.distinctAlbums === 1 ? '' : 's'} and ${totals.distinctSongs} song${totals.distinctSongs === 1 ? '' : 's'} ` +
        `by ${totals.distinctArtists} artist${totals.distinctArtists === 1 ? '' : 's'}.`,
    );
    if (topArtists.length > 0) {
      const [first, ...rest] = topArtists;
      parts.push(
        `${first.name} led the way with ${first.count} listen${first.count === 1 ? '' : 's'}` +
          (rest.length ? `, followed by ${joinWords(rest.slice(0, 3).map((artist) => artist.name))}.` : '.'),
      );
    }
    const repeat = topAlbums.find((album) => album.count > 1);
    if (repeat) parts.push(`Your most replayed album was ${repeat.title} by ${repeat.artistName} (${repeat.count} times).`);
    const busiest = weekdays.indexOf(Math.max(...weekdays));
    if (totals.entries >= 5) parts.push(`You logged the most music on ${WEEKDAYS[busiest]}s.`);
  } else {
    parts.push(`You didn’t log any listens from ${range}.`);
  }

  if (reviews.length > 0) {
    const rated = reviews.filter((review) => review.rating != null);
    const favourite = [...rated].sort((a, b) => b.rating - a.rating)[0];
    parts.push(
      `You wrote ${reviews.length} review${reviews.length === 1 ? '' : 's'}` +
        (favourite ? `, and your highest rating went to ${favourite.title} by ${favourite.artistName} (${formatStars(favourite.rating)}).` : '.'),
    );
  }
  if (ratings.count > 0) {
    parts.push(`Across ${ratings.count} rating${ratings.count === 1 ? '' : 's'} your average was ${formatStars(ratings.average)}.`);
  }
  return parts.join(' ');
}

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: { summary: { type: 'string' } },
  required: ['summary'],
  additionalProperties: false,
};

async function writeAiSummary(period, data) {
  const payload = {
    period: { from: period.periodStart, to: period.periodEnd },
    listening: data.totals,
    mostLoggedArtists: data.topArtists,
    mostLoggedAlbums: data.topAlbums.map(({ title, artistName, count }) => ({ title, artistName, count })),
    listensByWeekday: Object.fromEntries(WEEKDAYS.map((day, index) => [day, data.weekdays[index]])),
    ratings: data.ratings,
    reviews: data.reviews.map((review) => ({ ...review, text: review.text.slice(0, REVIEW_EXCERPT_LENGTH) })),
  };
  const result = await generateJson({
    system:
      'You write personal listening recaps for TuneBoxd, a music diary and review site. ' +
      'Write 2 short paragraphs (120–200 words total) in the second person, warm but not gushing. ' +
      'Cover what they listened to most, any patterns, and what their reviews say about their taste. ' +
      'Use only facts from the data; never invent numbers, artists or opinions. Plain text, no headings or lists.',
    prompt: `Listening data:\n${JSON.stringify(payload, null, 2)}`,
    schema: SUMMARY_SCHEMA,
  });
  return result?.summary?.trim() || null;
}

/** body: { periodStart, periodEnd } */
export async function createSummary(userId, input) {
  const { values, fieldErrors, error } = validateSummaryPeriod(input);
  if (error) throw new ServiceError(400, error, fieldErrors);
  const period = { start: values.periodStart, end: values.periodEnd };
  const data = await gatherPeriod(userId, period);
  if (data.totals.entries === 0 && data.reviews.length === 0) {
    throw new ServiceError(400, 'You didn’t log or review anything in that period. Try a different date range.');
  }
  const aiText = isAiConfigured() ? await writeAiSummary(values, data) : null;
  const text = aiText ?? writeRuleSummary(values, data);
  const summary = await recommendationRepository.createSummary(userId, { ...values, text: text.slice(0, 5000) });
  return { ...summary, aiWritten: Boolean(aiText) };
}

export async function listSummaries(userId) {
  return { summaries: await recommendationRepository.listSummaries(userId), aiEnabled: isAiConfigured() };
}

export async function deleteSummary(userId, rawId) {
  const id = parseId(rawId);
  if (!id || !(await recommendationRepository.deleteSummary(id, userId))) {
    throw new ServiceError(404, 'Summary not found.');
  }
}
