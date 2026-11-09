import { Router } from 'express';
import * as insightsController from '../controllers/insightsController.js';
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();

// Statistics, recommendations and summaries for the signed-in user only.
// Someone else's statistics (if their diary is public) are at GET /api/users/:username/stats.
router.use(requireAuth);

router.get('/stats', insightsController.getStats);
router.get('/recommendations', insightsController.getRecommendations);
router.post('/recommendations/refresh', insightsController.refreshRecommendations);
router.get('/summaries', insightsController.listSummaries);
router.post('/summaries', insightsController.createSummary);
router.delete('/summaries/:id', insightsController.deleteSummary);
router.post('/discover', insightsController.discover);

export default router;
