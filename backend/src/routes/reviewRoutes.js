import { Router } from 'express';
import * as reviewController from '../controllers/reviewController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Public reads
router.get('/', reviewController.listRecent);
router.get('/:id', reviewController.getReview);
router.get('/:id/comments', reviewController.listComments);

// Writes need a session; ownership is checked in the services.
router.post('/', requireAuth, reviewController.createReview);
router.patch('/:id', requireAuth, reviewController.updateReview);
router.delete('/:id', requireAuth, reviewController.deleteReview);
router.post('/:id/comments', requireAuth, reviewController.createComment);

export default router;
