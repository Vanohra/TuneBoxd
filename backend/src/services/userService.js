/**
 * Profile business logic for the signed-in user.
 * Like authService, this only talks to storage through userRepository.
 */
import * as userRepository from '../repositories/userRepository.js';
import { DuplicateUserError } from '../repositories/userRepository.js';
import { ServiceError } from '../utils/errors.js';
import { toSafeUser } from '../utils/safeUser.js';
import { validateProfileUpdate } from '../utils/validation.js';
import { assertAccountActive, throwDuplicateError } from './authService.js';

/**
 * Loads the user a session points at, fresh from the database.
 * @returns the safe user, or null if the account no longer exists.
 * Throws a 403 ServiceError if the account has been suspended.
 */
export async function getSessionUser(userId) {
  const user = await userRepository.findUserById(userId);
  if (!user) return null;
  assertAccountActive(user);
  return toSafeUser(user);
}

/** Validates and applies username/email/display name/bio/avatar changes for the given user. */
export async function updateProfile(userId, input) {
  const { values, fieldErrors, error } = validateProfileUpdate(input);
  if (error) throw new ServiceError(400, error, fieldErrors);

  // Uniqueness checks ignore the user's own current values.
  const taken = [];
  const usernameOwner = await userRepository.findUserByUsername(values.username);
  if (usernameOwner && usernameOwner.id !== userId) taken.push('username');
  const emailOwner = await userRepository.findUserByEmail(values.email);
  if (emailOwner && emailOwner.id !== userId) taken.push('email');
  if (taken.length > 0) throwDuplicateError(taken);

  try {
    const updated = await userRepository.updateUser(userId, values);
    if (!updated) throw new ServiceError(401, 'Your session has expired. Please log in again.');
    return toSafeUser(updated);
  } catch (err) {
    if (err instanceof DuplicateUserError) throwDuplicateError([err.field]);
    throw err;
  }
}
