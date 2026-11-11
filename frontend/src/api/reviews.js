import { apiRequest } from './client.js';

export async function fetchRecentReviews({ limit, offset } = {}) {
  const params = new URLSearchParams();
  if (limit != null) params.set('limit', limit);
  if (offset != null) params.set('offset', offset);
  const query = params.toString();
  const { reviews } = await apiRequest(query ? `/reviews?${query}` : '/reviews');
  return reviews;
}

export async function fetchReview(id) {
  const { review } = await apiRequest(`/reviews/${encodeURIComponent(id)}`);
  return review;
}

export async function fetchUserReviews(username) {
  const { reviews } = await apiRequest(`/users/${encodeURIComponent(username)}/reviews`);
  return reviews;
}

/** The author is taken from the session on the server; no user ID is sent. */
export async function createReview({ targetType, mbid, text, rating }) {
  const { review } = await apiRequest('/reviews', { method: 'POST', body: { targetType, mbid, text, rating } });
  return review;
}

export async function updateReview(id, { text, rating }) {
  const { review } = await apiRequest(`/reviews/${id}`, { method: 'PATCH', body: { text, rating } });
  return review;
}

export function deleteReview(id) {
  return apiRequest(`/reviews/${id}`, { method: 'DELETE' });
}

export async function fetchComments(reviewId) {
  const { comments } = await apiRequest(`/reviews/${reviewId}/comments`);
  return comments;
}

export async function createComment(reviewId, text) {
  const { comment } = await apiRequest(`/reviews/${reviewId}/comments`, { method: 'POST', body: { text } });
  return comment;
}

export async function updateComment(id, text) {
  const { comment } = await apiRequest(`/comments/${id}`, { method: 'PATCH', body: { text } });
  return comment;
}

export function deleteComment(id) {
  return apiRequest(`/comments/${id}`, { method: 'DELETE' });
}

/** [{ id, label }] reasons a review can be reported for. */
export async function fetchReportReasons() {
  const { reasons } = await apiRequest('/reviews/report-reasons');
  return reasons;
}

export function reportReview(id, { reason, details }) {
  return apiRequest(`/reviews/${id}/report`, { method: 'POST', body: { reason, details } });
}
