/**
 * Reviews and ratings business logic.
 *
 * The author is ALWAYS the session user (`userId` comes from requireAuth), never
 * a user ID sent by the browser. Ownership is checked here, on the server.
 * `viewerId` (null when logged out) only adds `isOwner` flags.
 */
import * as reviewRepository from '../repositories/reviewRepository.js';
import { DuplicateReviewError } from '../repositories/reviewRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { ServiceError } from '../utils/errors.js';
import { parseId, validateNewReview, validateReviewUpdate } from '../utils/validation.js';
import { ensureLocalTarget, findLocalTarget } from './musicService.js';

const NOT_FOUND = 'Review not found.';

const withOwner = (review, viewerId) => ({ ...review, isOwner: viewerId != null && review.author.id === viewerId });

function requireReviewId(rawId) {
  const id = parseId(rawId);
  if (!id) throw new ServiceError(404, NOT_FOUND);
  return id;
}

export async function getReview(rawId, viewerId) {
  const review = await reviewRepository.findReviewById(requireReviewId(rawId));
  if (!review) throw new ServiceError(404, NOT_FOUND);
  return withOwner(review, viewerId);
}

/** Reviews + rating stats for an album/song page. Nothing saved locally yet = no reviews. */
export async function listForTarget(targetType, mbid, viewerId) {
  const target = await findLocalTarget(targetType, mbid);
  if (!target) {
    return { reviews: [], stats: { averageRating: null, ratingCount: 0, reviewCount: 0 }, viewerReviewId: null };
  }
  const [reviews, stats, viewerReviewId] = await Promise.all([
    reviewRepository.listReviewsForTarget(target),
    reviewRepository.getTargetStats(target),
    viewerId ? reviewRepository.findUserReviewIdForTarget(viewerId, target) : null,
  ]);
  return { reviews: reviews.map((review) => withOwner(review, viewerId)), stats, viewerReviewId };
}

export async function listByUsername(username, viewerId) {
  const user = await userRepository.findUserByUsername(String(username ?? ''));
  if (!user || user.accountStatus !== 'active') throw new ServiceError(404, 'User not found.');
  const reviews = await reviewRepository.listReviewsByUser(user.id);
  return reviews.map((review) => withOwner(review, viewerId));
}

export async function listRecent(viewerId) {
  const reviews = await reviewRepository.listRecentReviews({ limit: 12 });
  return reviews.map((review) => withOwner(review, viewerId));
}

export async function createReview(userId, input) {
  const { values, fieldErrors, error } = validateNewReview(input);
  if (error) throw new ServiceError(400, error, fieldErrors);

  // Confirms the album/song exists on MusicBrainz and finds or creates its MySQL row.
  const target = await ensureLocalTarget(values.targetType, values.mbid);

  const existingId = await reviewRepository.findUserReviewIdForTarget(userId, target);
  if (existingId) {
    throw new ServiceError(409, 'You’ve already reviewed this. Edit your existing review instead.', { reviewId: existingId });
  }
  try {
    const id = await reviewRepository.createReview(userId, target, values);
    return getReview(id, userId);
  } catch (err) {
    // A double-click can race past the check above; the UNIQUE key still catches it.
    if (err instanceof DuplicateReviewError) {
      throw new ServiceError(409, 'You’ve already reviewed this. Edit your existing review instead.');
    }
    throw err;
  }
}

/** Loads a review for a write and checks it belongs to the user and isn't removed. */
async function requireOwnReview(rawId, userId) {
  const ownership = await reviewRepository.findReviewOwnership(requireReviewId(rawId));
  if (!ownership || ownership.isRemoved) throw new ServiceError(404, NOT_FOUND);
  if (ownership.userId !== userId) throw new ServiceError(403, 'You can only change your own reviews.');
  return ownership.id;
}

export async function updateReview(userId, rawId, input) {
  const id = await requireOwnReview(rawId, userId);
  const { values, fieldErrors, error } = validateReviewUpdate(input);
  if (error) throw new ServiceError(400, error, fieldErrors);
  await reviewRepository.updateReview(id, userId, values);
  return getReview(id, userId);
}

export async function deleteReview(userId, rawId) {
  const id = await requireOwnReview(rawId, userId);
  await reviewRepository.deleteReview(id, userId);
}

/** Visible review count for profile stats. */
export function countByUser(userId) {
  return reviewRepository.countReviewsByUser(userId);
}

/** Throws 404 unless the review exists and is visible (used before reading/writing comments). */
export async function assertReviewVisible(reviewId) {
  const review = await reviewRepository.findReviewById(reviewId);
  if (!review) throw new ServiceError(404, NOT_FOUND);
  return review;
}
