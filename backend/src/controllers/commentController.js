import * as commentService from '../services/commentService.js';

// PATCH /api/comments/:id (requireAuth, owner only)
export async function updateComment(req, res) {
  const comment = await commentService.updateComment(req.currentUser.id, req.params.id, req.body ?? {});
  res.json({ comment, message: 'Comment updated.' });
}

// DELETE /api/comments/:id (requireAuth, owner only)
export async function deleteComment(req, res) {
  await commentService.deleteComment(req.currentUser.id, req.params.id);
  res.json({ message: 'Comment deleted.' });
}
