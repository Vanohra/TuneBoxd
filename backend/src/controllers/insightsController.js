import * as recommendationService from '../services/recommendationService.js';
import * as statsService from '../services/statsService.js';
import * as summaryService from '../services/summaryService.js';

// GET /api/insights/stats (requireAuth): your listening statistics
export async function getStats(req, res) {
  res.json({ stats: await statsService.getStats(req.currentUser.id) });
}

// GET /api/insights/recommendations (requireAuth)
export async function getRecommendations(req, res) {
  res.json(await recommendationService.getRecommendations(req.currentUser.id));
}

// POST /api/insights/recommendations/refresh (requireAuth)
export async function refreshRecommendations(req, res) {
  res.json({ ...(await recommendationService.refreshRecommendations(req.currentUser.id)), message: 'Recommendations refreshed.' });
}

// GET /api/insights/summaries (requireAuth)
export async function listSummaries(req, res) {
  res.json(await summaryService.listSummaries(req.currentUser.id));
}

// POST /api/insights/summaries (requireAuth) body: { periodStart, periodEnd }
export async function createSummary(req, res) {
  const summary = await summaryService.createSummary(req.currentUser.id, req.body ?? {});
  res.status(201).json({ summary, message: 'Summary created.' });
}

// DELETE /api/insights/summaries/:id (requireAuth, owner only)
export async function deleteSummary(req, res) {
  await summaryService.deleteSummary(req.currentUser.id, req.params.id);
  res.json({ message: 'Summary deleted.' });
}
