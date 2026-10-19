import { Router } from 'express';
import * as commentController from '../controllers/commentController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Reading and posting comments lives under /api/reviews/:id/comments.
router.patch('/:id', requireAuth, commentController.updateComment);
router.delete('/:id', requireAuth, commentController.deleteComment);

export default router;
