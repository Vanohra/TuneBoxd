/**
 * Custom lists business logic (features #10 and #16).
 *
 * The owner is ALWAYS the session user. Privacy is per list (lists.is_public)
 * and enforced here: a private list is only returned to its owner. Anyone else
 * gets the same 404 as for a list that doesn't exist, so private lists don't
 * reveal that they exist.
 */
import * as listRepository from '../repositories/listRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { ServiceError } from '../utils/errors.js';
import { LIST_MAX_ITEMS, parseId, validateList, validateListItem } from '../utils/validation.js';
import { ensureLocalTarget, findLocalTarget } from './musicService.js';

const NOT_FOUND = 'List not found.';

const withOwnerFlag = (list, viewerId) => ({ ...list, isOwner: viewerId != null && list.owner.id === viewerId });

/** Adds up to four cover previews to each list card. */
async function withPreviews(lists, viewerId) {
  const previews = await listRepository.listPreviewTargets(lists.map((list) => list.id));
  return lists.map((list) => ({ ...withOwnerFlag(list, viewerId), preview: previews.get(list.id) ?? [] }));
}

/** A list the viewer may see, or a 404. */
async function requireVisibleList(rawId, viewerId) {
  const id = parseId(rawId);
  const list = id ? await listRepository.findListById(id) : null;
  if (!list || (!list.isPublic && list.owner.id !== viewerId)) throw new ServiceError(404, NOT_FOUND);
  return list;
}

/** A list the user owns, for writes: 404 if missing/hidden, 403 if someone else's. */
async function requireOwnList(rawId, userId) {
  const list = await requireVisibleList(rawId, userId);
  if (list.owner.id !== userId) throw new ServiceError(403, 'You can only change your own lists.');
  return list;
}

export async function getList(rawId, viewerId) {
  const list = await requireVisibleList(rawId, viewerId);
  return { ...withOwnerFlag(list, viewerId), items: await listRepository.listItems(list.id) };
}

/** The signed-in user's lists, public and private. */
export async function listOwn(userId) {
  return withPreviews(await listRepository.listListsByUser(userId), userId);
}

/** Someone's lists: all of them for the owner, public ones for everyone else. */
export async function listByUsername(username, viewerId) {
  const user = await userRepository.findUserByUsername(String(username ?? ''));
  if (!user || user.accountStatus !== 'active') throw new ServiceError(404, 'User not found.');
  const lists = await listRepository.listListsByUser(user.id, { publicOnly: user.id !== viewerId });
  return withPreviews(lists, viewerId);
}

export async function listRecentPublic(viewerId) {
  return withPreviews(await listRepository.listRecentPublicLists({ limit: 12 }), viewerId);
}

/** For the "Add to list" picker on album/song pages. */
export async function listOwnForTarget(userId, targetType, mbid) {
  const target = await findLocalTarget(targetType, mbid);
  if (!target) {
    // Nothing saved locally yet, so it can't be in any list.
    const lists = await listRepository.listListsByUser(userId);
    return lists.map((list) => ({ ...list, hasTarget: false }));
  }
  return listRepository.listOwnListsWithMembership(userId, target);
}

export async function createList(userId, input) {
  const { values, fieldErrors, error } = validateList(input);
  if (error) throw new ServiceError(400, error, fieldErrors);
  const id = await listRepository.createList(userId, values);
  return getList(id, userId);
}

export async function updateList(userId, rawId, input) {
  const list = await requireOwnList(rawId, userId);
  const { values, fieldErrors, error } = validateList(input);
  if (error) throw new ServiceError(400, error, fieldErrors);
  await listRepository.updateList(list.id, userId, values);
  return getList(list.id, userId);
}

export async function deleteList(userId, rawId) {
  const list = await requireOwnList(rawId, userId);
  await listRepository.deleteList(list.id, userId);
}

export async function addItem(userId, rawId, input) {
  const list = await requireOwnList(rawId, userId);
  const { values, fieldErrors, error } = validateListItem(input);
  if (error) throw new ServiceError(400, error, fieldErrors);
  const target = await ensureLocalTarget(values.targetType, values.mbid);
  const outcome = await listRepository.addItem(list.id, target, LIST_MAX_ITEMS);
  if (outcome === 'exists') throw new ServiceError(409, `That ${values.targetType} is already in “${list.title}”.`);
  if (outcome === 'full') throw new ServiceError(400, `Lists can hold at most ${LIST_MAX_ITEMS} items.`);
  return getList(list.id, userId);
}

export async function removeItem(userId, rawId, key) {
  const list = await requireOwnList(rawId, userId);
  const removed = await listRepository.removeItem(list.id, key);
  if (!removed) throw new ServiceError(404, 'That item isn’t in this list.');
  return getList(list.id, userId);
}

/** body: { keys: [...] } with every item key exactly once, in the new order. */
export async function reorderItems(userId, rawId, input = {}) {
  const list = await requireOwnList(rawId, userId);
  const keys = Array.isArray(input.keys) ? input.keys.map(String) : null;
  const current = (await listRepository.listItems(list.id)).map((item) => item.key);
  const sameItems = keys && keys.length === current.length && new Set(keys).size === keys.length && keys.every((key) => current.includes(key));
  if (!sameItems) throw new ServiceError(400, 'The list changed. Refresh and try again.');
  await listRepository.reorderItems(list.id, keys);
  return getList(list.id, userId);
}

export function countByUser(userId, { publicOnly }) {
  return listRepository.countListsByUser(userId, { publicOnly });
}
