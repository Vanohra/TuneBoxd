import * as commentService from '../services/commentService.js';
import * as reviewService from '../services/reviewService.js';

const viewerIdOf = (req) => req.session?.userId ?? null;

// GET /api/reviews (recent reviews across TuneBoxd)
export async function listRecent(req, res) {
  res.json({ reviews: await reviewService.listRecent(viewerIdOf(req)) });
}

// GET /api/reviews/:id
export async function getReview(req, res) {
  res.json({ review: await reviewService.getReview(req.params.id, viewerIdOf(req)) });
}

// POST /api/reviews (requireAuth)
export async function createReview(req, res) {
  const review = await reviewService.createReview(req.currentUser.id, req.body ?? {});
  res.status(201).json({ review, message: 'Review saved.' });
}

// PATCH /api/reviews/:id (requireAuth, owner only)
export async function updateReview(req, res) {
  const review = await reviewService.updateReview(req.currentUser.id, req.params.id, req.body ?? {});
  res.json({ review, message: 'Review updated.' });
}

// DELETE /api/reviews/:id (requireAuth, owner only)
export async function deleteReview(req, res) {
  await reviewService.deleteReview(req.currentUser.id, req.params.id);
  res.json({ message: 'Review deleted.' });
}

// GET /api/reviews/:id/comments
export async function listComments(req, res) {
  res.json({ comments: await commentService.listForReview(req.params.id, viewerIdOf(req)) });
}

// POST /api/reviews/:id/comments (requireAuth)
export async function createComment(req, res) {
  const comment = await commentService.createComment(req.currentUser.id, req.params.id, req.body ?? {});
  res.status(201).json({ comment, message: 'Comment posted.' });
}
