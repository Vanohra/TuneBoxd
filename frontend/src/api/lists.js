import { apiRequest } from './client.js';

/** Your own lists (public and private), each with up to four `preview` targets. */
export async function fetchMyLists() {
  const { lists } = await apiRequest('/lists');
  return lists;
}

/** Someone's lists: public ones, or all of them when it's you. */
export async function fetchUserLists(username) {
  const { lists } = await apiRequest(`/users/${encodeURIComponent(username)}/lists`);
  return lists;
}

/** Newest public lists across TuneBoxd. */
export async function fetchRecentLists() {
  const { lists } = await apiRequest('/lists/recent');
  return lists;
}

/** A list with its `items`. Private lists 404 for everyone but their owner. */
export async function fetchList(id) {
  const { list } = await apiRequest(`/lists/${encodeURIComponent(id)}`);
  return list;
}

/** Your lists, each with `hasTarget` for the given album/song. */
export async function fetchMyListsFor(targetType, mbid) {
  const { lists } = await apiRequest(`/lists/for/${targetType}/${encodeURIComponent(mbid)}`);
  return lists;
}

export async function createList({ title, description, isPublic }) {
  const { list } = await apiRequest('/lists', { method: 'POST', body: { title, description, isPublic } });
  return list;
}

export async function updateList(id, { title, description, isPublic }) {
  const { list } = await apiRequest(`/lists/${id}`, { method: 'PATCH', body: { title, description, isPublic } });
  return list;
}

export function deleteList(id) {
  return apiRequest(`/lists/${id}`, { method: 'DELETE' });
}

export async function addListItem(id, { targetType, mbid }) {
  const { list } = await apiRequest(`/lists/${id}/items`, { method: 'POST', body: { targetType, mbid } });
  return list;
}

export async function removeListItem(id, key) {
  const { list } = await apiRequest(`/lists/${id}/items/${encodeURIComponent(key)}`, { method: 'DELETE' });
  return list;
}

/** `keys`: every item key, in the new order. */
export async function reorderList(id, keys) {
  const { list } = await apiRequest(`/lists/${id}/order`, { method: 'PUT', body: { keys } });
  return list;
}
