/**
 * Listening diary business logic.
 *
 * Privacy is diary-level, using the existing user_settings.diary_visibility
 * column ('public' by default). It is enforced here on the server: a private
 * diary is only returned to its owner, whatever the frontend shows.
 */
import * as diaryRepository from '../repositories/diaryRepository.js';
import * as userRepository from '../repositories/userRepository.js';
import { ServiceError } from '../utils/errors.js';
import {
  DIARY_VISIBILITIES,
  parseId,
  validateDiaryUpdate,
  validateNewDiaryEntry,
} from '../utils/validation.js';
import { ensureLocalTarget } from './musicService.js';

const NOT_FOUND = 'Diary entry not found.';

/** The signed-in user's whole diary plus their privacy setting. */
export async function getOwnDiary(userId) {
  const [entries, visibility] = await Promise.all([
    diaryRepository.listEntriesByUser(userId),
    diaryRepository.getDiaryVisibility(userId),
  ]);
  return { entries, visibility };
}

/** Someone's diary as seen by `viewerId` (null = logged out). 403 when private. */
export async function getDiaryForUsername(username, viewerId) {
  const user = await userRepository.findUserByUsername(String(username ?? ''));
  if (!user || user.accountStatus !== 'active') throw new ServiceError(404, 'User not found.');
  if (user.id === viewerId) return { ...(await getOwnDiary(user.id)), isOwner: true };

  const visibility = await diaryRepository.getDiaryVisibility(user.id);
  if (visibility !== 'public') throw new ServiceError(403, `@${user.username}’s diary is private.`);
  return { entries: await diaryRepository.listEntriesByUser(user.id), visibility, isOwner: false };
}

export async function createEntry(userId, input) {
  const { values, fieldErrors, error } = validateNewDiaryEntry(input);
  if (error) throw new ServiceError(400, error, fieldErrors);
  const target = await ensureLocalTarget(values.targetType, values.mbid);
  const id = await diaryRepository.createEntry(userId, target, values);
  return diaryRepository.findEntryById(id);
}

async function requireOwnEntry(rawId, userId) {
  const id = parseId(rawId);
  const entry = id ? await diaryRepository.findEntryById(id) : null;
  if (!entry) throw new ServiceError(404, NOT_FOUND);
  if (entry.userId !== userId) throw new ServiceError(403, 'You can only change your own diary entries.');
  return entry;
}

export async function updateEntry(userId, rawId, input) {
  const entry = await requireOwnEntry(rawId, userId);
  const { values, fieldErrors, error } = validateDiaryUpdate(input);
  if (error) throw new ServiceError(400, error, fieldErrors);
  await diaryRepository.updateEntry(entry.id, userId, values);
  return diaryRepository.findEntryById(entry.id);
}

export async function deleteEntry(userId, rawId) {
  const entry = await requireOwnEntry(rawId, userId);
  await diaryRepository.deleteEntry(entry.id, userId);
}

export async function setVisibility(userId, input = {}) {
  const visibility = input.visibility;
  if (!DIARY_VISIBILITIES.includes(visibility)) {
    throw new ServiceError(400, 'Visibility must be public or private.', { visibility: 'Choose public or private.' });
  }
  await diaryRepository.setDiaryVisibility(userId, visibility);
  return visibility;
}

export function countByUser(userId) {
  return diaryRepository.countEntriesByUser(userId);
}
