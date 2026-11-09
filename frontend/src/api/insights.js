import { apiRequest } from './client.js';

/** Your listening statistics. */
export async function fetchMyStats() {
  const { stats } = await apiRequest('/insights/stats');
  return stats;
}

/** Someone's statistics. Throws a 403 ApiError when their diary is private. */
export async function fetchUserStats(username) {
  const { stats } = await apiRequest(`/users/${encodeURIComponent(username)}/stats`);
  return stats;
}

/** { recommendations, generatedAt, aiEnabled } */
export function fetchRecommendations() {
  return apiRequest('/insights/recommendations');
}

export function refreshRecommendations() {
  return apiRequest('/insights/recommendations/refresh', { method: 'POST' });
}

/** { summaries, aiEnabled } */
export function fetchSummaries() {
  return apiRequest('/insights/summaries');
}

/** Dates are "YYYY-MM-DD". */
export async function createSummary({ periodStart, periodEnd }) {
  const { summary } = await apiRequest('/insights/summaries', { method: 'POST', body: { periodStart, periodEnd } });
  return summary;
}

export function deleteSummary(id) {
  return apiRequest(`/insights/summaries/${id}`, { method: 'DELETE' });
}

/** Ask TuneBoxd: { prompt, interpretation, results: [album + reason + alreadyKnown], suggestedCount } */
export function discoverMusic(prompt) {
  return apiRequest('/insights/discover', { method: 'POST', body: { prompt } });
}
