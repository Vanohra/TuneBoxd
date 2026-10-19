/**
 * Comments on reviews. Anyone can read comments on a visible review; writing
 * needs a session, and only the author can edit or delete a comment.
 */
import * as commentRepository from '../repositories/commentRepository.js';
import { ServiceError } from '../utils/errors.js';
import { parseId, validateComment } from '../utils/validation.js';
import { assertReviewVisible } from './reviewService.js';

const withOwner = (comment, viewerId) => ({ ...comment, isOwner: viewerId != null && comment.author.id === viewerId });

function requireReviewId(rawId) {
  const id = parseId(rawId);
  if (!id) throw new ServiceError(404, 'Review not found.');
  return id;
}

function requireCommentId(rawId) {
  const id = parseId(rawId);
  if (!id) throw new ServiceError(404, 'Comment not found.');
  return id;
}

export async function listForReview(rawReviewId, viewerId) {
  const reviewId = requireReviewId(rawReviewId);
  await assertReviewVisible(reviewId); // removed reviews don't expose their comments
  const comments = await commentRepository.listCommentsForReview(reviewId);
  return comments.map((comment) => withOwner(comment, viewerId));
}

export async function createComment(userId, rawReviewId, input) {
  const reviewId = requireReviewId(rawReviewId);
  const { values, fieldErrors, error } = validateComment(input);
  if (error) throw new ServiceError(400, error, fieldErrors);
  await assertReviewVisible(reviewId); // can't comment on missing or removed reviews

  try {
    const id = await commentRepository.createComment(reviewId, userId, values.text);
    return withOwner(await commentRepository.findCommentById(id), userId);
  } catch (err) {
    // The review was deleted between the check and the insert (foreign key failure).
    if (err.code === 'ER_NO_REFERENCED_ROW_2') throw new ServiceError(404, 'Review not found.');
    throw err;
  }
}

async function requireOwnComment(rawId, userId) {
  const comment = await commentRepository.findCommentById(requireCommentId(rawId));
  if (!comment) throw new ServiceError(404, 'Comment not found.');
  if (comment.author.id !== userId) throw new ServiceError(403, 'You can only change your own comments.');
  return comment;
}

export async function updateComment(userId, rawId, input) {
  const comment = await requireOwnComment(rawId, userId);
  const { values, fieldErrors, error } = validateComment(input);
  if (error) throw new ServiceError(400, error, fieldErrors);
  await assertReviewVisible(comment.reviewId);
  await commentRepository.updateComment(comment.id, userId, values.text);
  return withOwner(await commentRepository.findCommentById(comment.id), userId);
}

export async function deleteComment(userId, rawId) {
  const comment = await requireOwnComment(rawId, userId);
  await commentRepository.deleteComment(comment.id, userId);
}
