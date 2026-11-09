/**
 * Reporting inappropriate reviews (feature #17).
 *
 * Any signed-in member can report someone else's visible review once. Reports
 * go to the administrator queue (moderationService); the reporter is never
 * shown to the review's author.
 */
import * as reportRepository from '../repositories/reportRepository.js';
import { DuplicateReportError } from '../repositories/reportRepository.js';
import { ServiceError } from '../utils/errors.js';
import { parseId, REPORT_REASONS, validateReport } from '../utils/validation.js';
import { assessInBackground } from './moderationService.js';
import { assertReviewVisible } from './reviewService.js';

const ALREADY_REPORTED = 'You’ve already reported this review. An administrator will look at it.';

export async function reportReview(userId, rawReviewId, input) {
  const reviewId = parseId(rawReviewId);
  if (!reviewId) throw new ServiceError(404, 'Review not found.');
  const review = await assertReviewVisible(reviewId);
  if (review.author.id === userId) throw new ServiceError(400, 'You can’t report your own review.');

  const { values, fieldErrors, error } = validateReport(input);
  if (error) throw new ServiceError(400, error, fieldErrors);

  if (await reportRepository.hasReported(reviewId, userId)) throw new ServiceError(409, ALREADY_REPORTED);
  try {
    await reportRepository.createReport(reviewId, userId, values);
  } catch (err) {
    if (err instanceof DuplicateReportError) throw new ServiceError(409, ALREADY_REPORTED);
    throw err;
  }
  // The AI moderation assistant reads the review (and every report on it) in the background.
  assessInBackground(reviewId);
}

/** Reason codes and labels for the report form. */
export function listReasons() {
  return Object.entries(REPORT_REASONS).map(([id, label]) => ({ id, label }));
}
