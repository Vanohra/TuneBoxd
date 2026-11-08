/**
 * Personal listening statistics (feature #19, client requirement CR-03):
 * frequently logged artists, the number of distinct albums logged and monthly
 * diary entry counts, all from the user's listening diary.
 *
 * Statistics reveal what is in the diary, so they follow the diary's privacy
 * setting: a private diary's statistics are only returned to its owner.
 */
import * as diaryRepository from '../repositories/diaryRepository.js';
import * as statsRepository from '../repositories/statsRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { ServiceError } from '../utils/errors.js';

const MONTHS_SHOWN = 12;

/** ["2025-12", ..., "2026-11"]: the last `count` months, ending with the current one (UTC). */
export function lastMonths(count, now = new Date()) {
  const months = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(date.toISOString().slice(0, 7));
  }
  return months;
}

/** Monthly counts with zero-filled gaps for every month in `months`. */
export function fillMonths(months, counts) {
  const byMonth = new Map(counts.map((row) => [row.month, row.count]));
  return months.map((month) => ({ month, count: byMonth.get(month) ?? 0 }));
}

export async function getStats(userId) {
  const months = lastMonths(MONTHS_SHOWN);
  const [totals, topArtists, topAlbums, monthly, weekdays, ratings] = await Promise.all([
    statsRepository.getTotals(userId),
    statsRepository.getTopArtists(userId, undefined, 10),
    statsRepository.getTopAlbums(userId, undefined, 6),
    statsRepository.getMonthlyCounts(userId, months[0]),
    statsRepository.getWeekdayCounts(userId),
    statsRepository.getRatingStats(userId),
  ]);
  return { totals, topArtists, topAlbums, monthly: fillMonths(months, monthly), weekdays, ratings };
}

/** Someone's statistics as seen by `viewerId`. 403 when their diary is private. */
export async function getStatsForUsername(username, viewerId) {
  const user = await userRepository.findUserByUsername(String(username ?? ''));
  if (!user || user.accountStatus !== 'active') throw new ServiceError(404, 'User not found.');
  const isOwner = user.id === viewerId;
  if (!isOwner && (await diaryRepository.getDiaryVisibility(user.id)) !== 'public') {
    throw new ServiceError(403, `@${user.username}’s listening statistics are private.`);
  }
  return { ...(await getStats(user.id)), isOwner };
}
