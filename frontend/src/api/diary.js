import { apiRequest } from './client.js';

/** Your own diary: { entries, visibility }. */
export function fetchMyDiary() {
  return apiRequest('/diary');
}

/** Someone's diary: { entries, visibility, isOwner }. Throws a 403 ApiError when it is private. */
export function fetchUserDiary(username) {
  return apiRequest(`/users/${encodeURIComponent(username)}/diary`);
}

/** listenedOn is "YYYY-MM-DD". */
export async function createDiaryEntry({ targetType, mbid, listenedOn, notes }) {
  const { entry } = await apiRequest('/diary', { method: 'POST', body: { targetType, mbid, listenedOn, notes } });
  return entry;
}

export async function updateDiaryEntry(id, { listenedOn, notes }) {
  const { entry } = await apiRequest(`/diary/${id}`, { method: 'PATCH', body: { listenedOn, notes } });
  return entry;
}

export function deleteDiaryEntry(id) {
  return apiRequest(`/diary/${id}`, { method: 'DELETE' });
}

export async function setDiaryVisibility(visibility) {
  const response = await apiRequest('/diary/settings', { method: 'PUT', body: { visibility } });
  return response.visibility;
}
